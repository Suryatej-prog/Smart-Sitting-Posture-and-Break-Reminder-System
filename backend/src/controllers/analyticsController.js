const SittingSession = require('../models/SittingSession');
const BreakEvent = require('../models/BreakEvent');
const { asyncHandler } = require('../middleware/errorHandler');

// Sum whole-session stats for sessions overlapping [dayStart, dayEnd).
// Sessions that span midnight count toward the day they started in.
function dayRange(dateStr, tzOffsetMinutes) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(base.getTime())) {
    const err = new Error('date must be a valid date (YYYY-MM-DD or ISO)');
    err.statusCode = 400; err.errorCode = 'BAD_PARAM';
    throw err;
  }
  const offsetMs = (Number.isFinite(Number(tzOffsetMinutes)) ? Number(tzOffsetMinutes) : 0) * 60000;
  const local = new Date(base.getTime() + offsetMs);
  const startUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(startUtc - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function summarizeDay(deviceId, start, end) {
  const sessionFilter = { startTime: { $gte: start, $lt: end } };
  const breakFilter = { timestamp: { $gte: start, $lt: end } };
  if (deviceId) { sessionFilter.deviceId = deviceId; breakFilter.deviceId = deviceId; }
  const [sessionAgg] = await SittingSession.aggregate([
    { $match: sessionFilter },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        totalSittingSeconds: { $sum: '$durationSeconds' },
        totalSlouchingSeconds: { $sum: '$slouchingSeconds' },
        postureWarnings: { $sum: '$postureWarnings' },
        breakReminders: { $sum: '$breakReminders' },
        longestSessionSeconds: { $max: '$durationSeconds' }
      }
    }
  ]);
  const breaksTaken = await BreakEvent.countDocuments({ ...breakFilter, breakTaken: true });
  const totals = sessionAgg || {
    sessions: 0, totalSittingSeconds: 0, totalSlouchingSeconds: 0,
    postureWarnings: 0, breakReminders: 0, longestSessionSeconds: 0
  };
  return {
    sittingSeconds: Math.round(totals.totalSittingSeconds),
    slouchingSeconds: Math.round(totals.totalSlouchingSeconds),
    goodPostureSeconds: Math.round(Math.max(0, totals.totalSittingSeconds - totals.totalSlouchingSeconds)),
    sessions: totals.sessions,
    postureWarnings: totals.postureWarnings,
    breakReminders: totals.breakReminders,
    breaksTaken,
    longestSessionSeconds: Math.round(totals.longestSessionSeconds || 0)
  };
}

// GET /api/analytics/daily?date=YYYY-MM-DD&device_id=&tz_offset_minutes=330
const getDailyAnalytics = asyncHandler(async (req, res) => {
  const { start, end } = dayRange(req.query.date, req.query.tz_offset_minutes);
  const summary = await summarizeDay(req.query.device_id, start, end);
  res.json({ date: start.toISOString().slice(0, 10), ...summary });
});

// GET /api/analytics/weekly?end=YYYY-MM-DD&device_id=&tz_offset_minutes=330
// Seven daily summaries ending on `end` (default: today).
const getWeeklyAnalytics = asyncHandler(async (req, res) => {
  const { end } = dayRange(req.query.end, req.query.tz_offset_minutes);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(end.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const summary = await summarizeDay(req.query.device_id, dayStart, dayEnd);
    days.push({ date: dayStart.toISOString().slice(0, 10), ...summary });
  }
  const totals = days.reduce((acc, d) => ({
    sittingSeconds: acc.sittingSeconds + d.sittingSeconds,
    slouchingSeconds: acc.slouchingSeconds + d.slouchingSeconds,
    goodPostureSeconds: acc.goodPostureSeconds + d.goodPostureSeconds,
    sessions: acc.sessions + d.sessions,
    postureWarnings: acc.postureWarnings + d.postureWarnings,
    breakReminders: acc.breakReminders + d.breakReminders,
    breaksTaken: acc.breaksTaken + d.breaksTaken
  }), { sittingSeconds: 0, slouchingSeconds: 0, goodPostureSeconds: 0, sessions: 0, postureWarnings: 0, breakReminders: 0, breaksTaken: 0 });
  res.json({ days, totals });
});

module.exports = { getDailyAnalytics, getWeeklyAnalytics };
