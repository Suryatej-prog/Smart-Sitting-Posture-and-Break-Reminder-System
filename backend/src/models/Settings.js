const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Singleton document, always key 'global'.
    key: { type: String, default: 'global', unique: true },
    breakThresholdSeconds: { type: Number, default: 60, min: 5, max: 86400 },
    soundEnabled: { type: Boolean, default: true },
    volume: { type: Number, default: 0.8, min: 0, max: 1 },
    fullscreenWarning: { type: Boolean, default: true },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
