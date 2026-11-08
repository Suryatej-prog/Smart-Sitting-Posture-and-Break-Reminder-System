require('dotenv').config();

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  port: intFromEnv('PORT', 5000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/smartchair',
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID || 'smartchair-backend',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    sensorTopic: process.env.MQTT_SENSOR_TOPIC || 'smartchair/+/sensors',
    calibrationTopic: process.env.MQTT_CALIBRATION_TOPIC || 'smartchair/+/calibration',
    commandTopicPattern: process.env.MQTT_COMMAND_TOPIC_PATTERN || 'smartchair/{deviceId}/commands'
  },
  breakThresholdSeconds: intFromEnv('BREAK_THRESHOLD_SECONDS', 60)
};
