// In-memory view of the latest known state per device, rebuilt from MongoDB
// on startup so a restart never leaves the dashboard lying about live state.
const states = new Map();

function emptyState(deviceId) {
  return {
    deviceId,
    mqttConnected: false,
    lastMessageAt: null,
    isSeated: false,
    postureStatus: 'not_seated',
    distanceCm: null,
    sittingDurationSeconds: 0,
    breakRequired: false,
    sessionId: null,
    sessionStartTime: null,
    slouchingSeconds: 0,
    postureWarnings: 0,
    breakReminders: 0,
    breakThresholdSeconds: null,
    ledOn: false,
    buzzerOn: false,
    updatedAt: null
  };
}

function get(deviceId) {
  if (!states.has(deviceId)) states.set(deviceId, emptyState(deviceId));
  return states.get(deviceId);
}

function patch(deviceId, updates) {
  const state = get(deviceId);
  Object.assign(state, updates, { updatedAt: new Date().toISOString() });
  return state;
}

function setMqttConnected(connected) {
  for (const [deviceId] of states) patch(deviceId, { mqttConnected: connected });
}

function all() {
  return Array.from(states.values());
}

module.exports = { get, patch, all, setMqttConnected };
