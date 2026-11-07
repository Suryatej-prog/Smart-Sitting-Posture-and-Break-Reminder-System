const settingsService = require('../services/settingsService');
const mqttClient = require('../mqtt/client');
const liveStatus = require('../services/liveStatus');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings(true);
  res.json(settings);
});

// PUT /api/settings
const putSettings = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const updates = {};
  if (body.breakThresholdSeconds !== undefined) {
    const v = Number(body.breakThresholdSeconds);
    if (!Number.isFinite(v) || v < 5 || v > 86400) {
      return res.status(400).json({ error: 'BAD_PARAM', message: 'breakThresholdSeconds must be a number between 5 and 86400' });
    }
    updates.breakThresholdSeconds = Math.round(v);
  }
  for (const key of ['soundEnabled', 'fullscreenWarning']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') {
        return res.status(400).json({ error: 'BAD_PARAM', message: `${key} must be a boolean` });
      }
      updates[key] = body[key];
    }
  }
  if (body.volume !== undefined) {
    const v = Number(body.volume);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      return res.status(400).json({ error: 'BAD_PARAM', message: 'volume must be a number between 0 and 1' });
    }
    updates.volume = v;
  }
  if (body.theme !== undefined) {
    if (!['dark', 'light'].includes(body.theme)) {
      return res.status(400).json({ error: 'BAD_PARAM', message: "theme must be 'dark' or 'light'" });
    }
    updates.theme = body.theme;
  }
  const settings = await settingsService.updateSettings(updates);

  // Let each device know the threshold changed so the ESP32 can stay in sync.
  if (updates.breakThresholdSeconds !== undefined) {
    for (const device of liveStatus.all()) {
      mqttClient.publishCommand(device.deviceId, {
        type: 'settings-updated',
        break_threshold_seconds: settings.breakThresholdSeconds
      });
    }
  }
  res.json(settings);
});

module.exports = { getSettings, putSettings };
