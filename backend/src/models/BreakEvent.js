const mongoose = require('mongoose');

const breakEventSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SittingSession', default: null },
    timestamp: { type: Date, required: true },
    sittingDurationSeconds: { type: Number, default: 0 },
    status: { type: String, enum: ['triggered', 'acknowledged'], default: 'triggered' },
    breakTaken: { type: Boolean, default: false },
    breakTakenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

breakEventSchema.index({ deviceId: 1, timestamp: -1 });
// One break reminder per sitting session.
breakEventSchema.index(
  { sessionId: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: 'objectId' } }, name: 'one_break_event_per_session' }
);

module.exports = mongoose.model('BreakEvent', breakEventSchema);
