const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true },
    isSeated: { type: Boolean, required: true },
    distanceCm: { type: Number, default: null },
    postureStatus: {
      type: String,
      enum: ['sitting_straight', 'slouching', 'not_seated', 'unknown'],
      default: 'unknown'
    },
    sittingDurationSeconds: { type: Number, default: 0 },
    breakRequired: { type: Boolean, default: false },
    // Only set when the ESP32 reports its own LED/buzzer state (led_on / buzzer_on).
    reportedLedOn: { type: Boolean, default: null },
    reportedBuzzerOn: { type: Boolean, default: null }
  },
  { timestamps: true }
);

sensorReadingSchema.index({ deviceId: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
