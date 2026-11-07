const CalibrationSetting = require('../models/CalibrationSetting');
const mqttClient = require('../mqtt/client');
const realtime = require('../realtime/socket');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/calibration
// Body: { device_id, calibrated_distance_cm?, values?, timestamp? }
const saveCalibration = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const deviceId = body.device_id;
  if (typeof deviceId !== 'string' || deviceId.trim() === '') {
    return res.status(400).json({ error: 'BAD_PARAM', message: 'device_id is required and must be a non-empty string' });
  }
  const calibration = await CalibrationSetting.create({
    deviceId: deviceId.trim(),
    calibratedDistanceCm: Number.isFinite(Number(body.calibrated_distance_cm))
      ? Number(body.calibrated_distance_cm)
      : null,
    values: body.values && typeof body.values === 'object' ? body.values : {},
    calibratedAt: body.timestamp ? new Date(body.timestamp) : new Date()
  });
  realtime.emit('calibration-updated', { deviceId: calibration.deviceId });
  res.status(201).json(calibration);
});

// GET /api/calibration/latest?device_id=
const getLatestCalibration = asyncHandler(async (req, res) => {
  const filter = req.query.device_id ? { deviceId: req.query.device_id } : {};
  const latest = await CalibrationSetting.findOne(filter).sort({ calibratedAt: -1 }).lean();
  if (!latest) return res.status(404).json({ error: 'NOT_FOUND', message: 'No calibration recorded yet' });
  res.json(latest);
});

module.exports = { saveCalibration, getLatestCalibration };
