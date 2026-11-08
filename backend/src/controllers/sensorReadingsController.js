const SensorReading = require('../models/SensorReading');
const { asyncHandler } = require('../middleware/errorHandler');

function parseDate(value, name) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`${name} must be a valid date or ISO timestamp`);
    err.statusCode = 400; err.errorCode = 'BAD_PARAM';
    throw err;
  }
  return d;
}

function paged(queryDefaults = {}) {
  return (req) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = { ...queryDefaults };
    if (req.query.device_id) filter.deviceId = req.query.device_id;
    if (req.query.from) filter.timestamp = { ...filter.timestamp, $gte: parseDate(req.query.from, 'from') };
    if (req.query.to) filter.timestamp = { ...filter.timestamp, $lte: parseDate(req.query.to, 'to') };
    return { page, limit, filter };
  };
}

// GET /api/sensor-readings?device_id=&from=&to=&page=&limit=
const listSensorReadings = asyncHandler(async (req, res) => {
  const { page, limit, filter } = paged()(req);
  const [total, items] = await Promise.all([
    SensorReading.countDocuments(filter),
    SensorReading.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.json({ page, limit, total, items });
});

module.exports = { listSensorReadings, paged };
