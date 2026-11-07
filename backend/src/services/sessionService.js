const SensorReading = require('../models/SensorReading');
const SittingSession = require('../models/SittingSession');
const BreakEvent = require('../models/BreakEvent');
const liveStatus = require('./liveStatus');
const settingsService = require('./settingsService');
const realtime = require('../realtime/socket');

const POSTURE = {
  STRAIGHT: 'sitting_straight',
  SLOUCHING: 'slouching',
  NOT_SEATED: 'not_seated',
  UNKNOWN: 'unknown'
};

function normalizePosture(value, isSeated) {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (Object.values(POSTURE).includes(v)) return v;
  }
  return isSeated ? POSTURE.UNKNOWN : POSTURE.NOT_SEATED;
}

// Validate and normalize one MQTT sensor payload. Returns { reading } or { error }.
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'payload must be a JSON object' };
  }
  const deviceId = payload.device_id;
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    return { error: 'device_id is required and must be a non-empty string' };
  }
  if (typeof payload.is_seated !== 'boolean') {
    return { error: 'is_seated is required and must be a boolean' };
  }
  let timestamp = new Date();
  if (payload.timestamp !== undefined && payload.timestamp !== null) {
    timestamp = new Date(payload.timestamp);
    if (Number.isNaN(timestamp.getTime())) return { error: 'timestamp is not a valid date' };
  }
  const distanceCm = payload.distance_cm === undefined || payload.distance_cm === null
    ? null
    : Number(payload.distance_cm);
  if (distanceCm !== null && !Number.isFinite(distanceCm)) {
    return { error: 'distance_cm must be a number' };
  }
  const sittingDurationSeconds = Number.isFinite(Number(payload.sitting_duration_seconds))
    ? Number(payload.sitting_duration_seconds)
    : 0;
  return {
    reading: {
      deviceId: deviceId.trim(),
      timestamp,
      isSeated: payload.is_seated,
      distanceCm,
      postureStatus: normalizePosture(payload.posture_status, payload.is_seated),
      sittingDurationSeconds,
      breakRequired: payload.break_required === true
    }
  };
}

async function findOpenSession(deviceId) {
  return SittingSession.findOne({ deviceId, endTime: null });
}

async function processReadingInternal(reading) {
  // 1. Always store every valid reading.
  const saved = await SensorReading.create(reading);

  const state = liveStatus.get(reading.deviceId);
  const settings = await settingsService.getSettings();
  const threshold = settings.breakThresholdSeconds;

  const prevTs = state.lastMessageAt ? new Date(state.lastMessageAt) : null;
  // Time since the previous reading is attributed to the posture we last saw,
  // so slouching time accumulates between messages.
  const deltaSeconds = prevTs && reading.timestamp > prevTs
    ? (reading.timestamp - prevTs) / 1000
    : 0;

  let session = await findOpenSession(reading.deviceId);
  let postureWarning = null;
  let breakEvent = null;
  let sessionEnded = null;
  let sessionStarted = null;

  if (reading.isSeated) {
    if (!session) {
      // 2. Sitting started: open exactly one session (unique index guards races).
      try {
        session = await SittingSession.create({
          deviceId: reading.deviceId,
          startTime: reading.timestamp
        });
        sessionStarted = session;
      } catch (err) {
        if (err.code !== 11000) throw err; // duplicate open session: reuse it
        session = await findOpenSession(reading.deviceId);
      }
    } else {
      const patch = {};
      if (state.postureStatus === POSTURE.SLOUCHING && deltaSeconds > 0) {
        patch.slouchingSeconds = session.slouchingSeconds + deltaSeconds;
      }
      patch.durationSeconds = Math.max(0, (reading.timestamp - session.startTime) / 1000);

      // 3. Posture warning counts only the transition into slouching.
      const becameSlouching =
        reading.postureStatus === POSTURE.SLOUCHING && state.postureStatus !== POSTURE.SLOUCHING;
      if (becameSlouching) {
        patch.postureWarnings = session.postureWarnings + 1;
        postureWarning = { deviceId: reading.deviceId, at: reading.timestamp };
      }
      Object.assign(session, patch);
    }

    // 4. One break reminder per session once the threshold is crossed.
    const sittingSeconds = (reading.timestamp - session.startTime) / 1000;
    if (!session.breakReminderSent && sittingSeconds >= threshold) {
      try {
        breakEvent = await BreakEvent.create({
          deviceId: reading.deviceId,
          sessionId: session._id,
          timestamp: reading.timestamp,
          sittingDurationSeconds: Math.round(sittingSeconds)
        });
        session.breakReminderSent = true;
        session.breakReminders += 1;
      } catch (err) {
        if (err.code !== 11000) throw err; // already recorded for this session
        session.breakReminderSent = true;
      }
    }
    if (session.isModified()) await session.save();

    liveStatus.patch(reading.deviceId, {
      mqttConnected: true,
      lastMessageAt: reading.timestamp.toISOString(),
      isSeated: true,
      postureStatus: reading.postureStatus,
      distanceCm: reading.distanceCm,
      sittingDurationSeconds: Math.round(sittingSeconds),
      breakRequired: sittingSeconds >= threshold,
      sessionId: String(session._id),
      sessionStartTime: session.startTime.toISOString(),
      slouchingSeconds: Math.round(session.slouchingSeconds),
      postureWarnings: session.postureWarnings,
      breakReminders: session.breakReminders,
      breakThresholdSeconds: threshold,
      ledOn: reading.postureStatus === POSTURE.SLOUCHING,
      buzzerOn: sittingSeconds >= threshold
    });
  } else {
    // 5. Standing up closes the open session, if any.
    if (session) {
      session.endTime = reading.timestamp;
      session.durationSeconds = Math.max(0, (reading.timestamp - session.startTime) / 1000);
      if (state.postureStatus === POSTURE.SLOUCHING && deltaSeconds > 0) {
        session.slouchingSeconds += deltaSeconds;
      }
      await session.save();
      sessionEnded = session;

      // A break reminder counts as taken once the user stands up.
      await BreakEvent.updateMany(
        { sessionId: session._id, breakTaken: false },
        { $set: { breakTaken: true, breakTakenAt: reading.timestamp, status: 'acknowledged' } }
      );
    }
    liveStatus.patch(reading.deviceId, {
      mqttConnected: true,
      lastMessageAt: reading.timestamp.toISOString(),
      isSeated: false,
      postureStatus: POSTURE.NOT_SEATED,
      distanceCm: reading.distanceCm,
      sittingDurationSeconds: 0,
      breakRequired: false,
      sessionId: null,
      sessionStartTime: null,
      breakThresholdSeconds: threshold,
      ledOn: false,
      buzzerOn: false
    });
  }

  // 6. Real-time updates to every connected dashboard.
  realtime.emit('live-status', liveStatus.get(reading.deviceId));
  if (sessionStarted) realtime.emit('session-started', { deviceId: reading.deviceId, sessionId: String(session._id), startTime: session.startTime });
  if (postureWarning) realtime.emit('posture-warning', postureWarning);
  if (breakEvent) realtime.emit('break-reminder', { deviceId: reading.deviceId, breakEventId: String(breakEvent._id), sittingDurationSeconds: breakEvent.sittingDurationSeconds });
  if (sessionEnded) realtime.emit('session-ended', { deviceId: reading.deviceId, sessionId: String(sessionEnded._id), durationSeconds: sessionEnded.durationSeconds });

  return saved;
}

// After a restart, rebuild the in-memory live state from the database so the
// dashboard does not show a closed session as live.
async function rebuildLiveState() {
  const openSessions = await SittingSession.find({ endTime: null });
  for (const session of openSessions) {
    const last = await SensorReading.findOne({ deviceId: session.deviceId }).sort({ timestamp: -1 });
    const settings = await settingsService.getSettings();
    liveStatus.patch(session.deviceId, {
      lastMessageAt: last ? last.timestamp.toISOString() : session.startTime.toISOString(),
      isSeated: true,
      postureStatus: last ? last.postureStatus : POSTURE.UNKNOWN,
      distanceCm: last ? last.distanceCm : null,
      sittingDurationSeconds: Math.round(((last ? last.timestamp : session.startTime) - session.startTime) / 1000),
      breakRequired: session.breakReminderSent,
      sessionId: String(session._id),
      sessionStartTime: session.startTime.toISOString(),
      slouchingSeconds: Math.round(session.slouchingSeconds),
      postureWarnings: session.postureWarnings,
      breakReminders: session.breakReminders,
      breakThresholdSeconds: settings.breakThresholdSeconds
    });
  }
}

// MQTT messages for one device are processed strictly in arrival order, so a
// fast burst of readings cannot open two sessions or count time twice.
const deviceQueues = new Map();
function processReading(reading) {
  const prev = deviceQueues.get(reading.deviceId) || Promise.resolve();
  const next = prev.then(() => processReadingInternal(reading));
  deviceQueues.set(reading.deviceId, next.catch(() => {}));
  return next;
}

module.exports = { validatePayload, processReading, rebuildLiveState, POSTURE };
