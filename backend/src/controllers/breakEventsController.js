const mongoose = require('mongoose');
const BreakEvent = require('../models/BreakEvent');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/break-events?device_id=&from=&to=&page=&limit=
const listBreakEvents = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = {};
  if (req.query.device_id) filter.deviceId = req.query.device_id;
  if (req.query.from) filter.timestamp = { ...filter.timestamp, $gte: new Date(req.query.from) };
  if (req.query.to) filter.timestamp = { ...filter.timestamp, $lte: new Date(req.query.to) };
  const [total, items] = await Promise.all([
    BreakEvent.countDocuments(filter),
    BreakEvent.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.json({ page, limit, total, items });
});

// POST /api/break-events/:id/acknowledge  (the dashboard "I've taken a break" button)
const acknowledgeBreakEvent = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'BAD_ID', message: 'Invalid break event id' });
  }
  const event = await BreakEvent.findByIdAndUpdate(
    req.params.id,
    { $set: { breakTaken: true, breakTakenAt: new Date(), status: 'acknowledged' } },
    { new: true }
  );
  if (!event) return res.status(404).json({ error: 'NOT_FOUND', message: 'Break event not found' });
  res.json(event);
});

module.exports = { listBreakEvents, acknowledgeBreakEvent };
