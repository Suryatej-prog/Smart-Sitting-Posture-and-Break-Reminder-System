const mongoose = require('mongoose');
const SittingSession = require('../models/SittingSession');
const BreakEvent = require('../models/BreakEvent');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/sessions?device_id=&from=&to=&page=&limit=
const listSessions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = {};
  if (req.query.device_id) filter.deviceId = req.query.device_id;
  if (req.query.from) filter.startTime = { ...filter.startTime, $gte: new Date(req.query.from) };
  if (req.query.to) filter.startTime = { ...filter.startTime, $lte: new Date(req.query.to) };
  const [total, items] = await Promise.all([
    SittingSession.countDocuments(filter),
    SittingSession.find(filter).sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.json({ page, limit, total, items });
});

// GET /api/sessions/:id
const getSession = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'BAD_ID', message: 'Invalid session id' });
  }
  const session = await SittingSession.findById(req.params.id).lean();
  if (!session) return res.status(404).json({ error: 'NOT_FOUND', message: 'Session not found' });
  const breakEvents = await BreakEvent.find({ sessionId: session._id }).lean();
  res.json({ ...session, breakEvents });
});

module.exports = { listSessions, getSession };
