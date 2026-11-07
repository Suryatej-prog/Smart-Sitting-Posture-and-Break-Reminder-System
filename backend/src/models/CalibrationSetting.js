const mongoose = require('mongoose');

const calibrationSettingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    calibratedDistanceCm: { type: Number, default: null },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    calibratedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

calibrationSettingSchema.index({ deviceId: 1, calibratedAt: -1 });

module.exports = mongoose.model('CalibrationSetting', calibrationSettingSchema);
