const liveStatus = require('../services/liveStatus');
const mqttClient = require('../mqtt/client');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/live-status?device_id=chair_01
// Without device_id, returns every known device.
const getLiveStatus = asyncHandler(async (req, res) => {
  const { device_id: deviceId } = req.query;
  const mqtt = mqttClient.stats();
  if (deviceId) {
    const state = liveStatus.get(deviceId);
    return res.json({ ...state, mqttConnected: mqtt.connected });
  }
  const devices = liveStatus.all().map((s) => ({ ...s, mqttConnected: mqtt.connected }));
  res.json({ mqttConnected: mqtt.connected, devices });
});

module.exports = { getLiveStatus };
