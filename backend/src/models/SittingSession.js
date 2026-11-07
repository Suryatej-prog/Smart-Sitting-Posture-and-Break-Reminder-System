const mongoose = require('mongoose');

const sittingSessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    slouchingSeconds: { type: Number, default: 0 },
    postureWarnings: { type: Number, default: 0 },
    breakReminders: { type: Number, default: 0 },
    // Set once the break reminder for this session has fired so the same
    // threshold crossing never creates duplicate break events.
    breakReminderSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

sittingSessionSchema.index({ deviceId: 1, startTime: -1 });
// At most one open (endTime = null) session per device: this blocks duplicate
// sessions even if repeated sensor messages arrive at the same time.
sittingSessionSchema.index(
  { deviceId: 1 },
  { unique: true, partialFilterExpression: { endTime: null }, name: 'one_open_session_per_device' }
);

module.exports = mongoose.model('SittingSession', sittingSessionSchema);
