const mqtt = require('mqtt');
const config = require('../config/env');
const liveStatus = require('../services/liveStatus');
const sessionService = require('../services/sessionService');
const CalibrationSetting = require('../models/CalibrationSetting');
const realtime = require('../realtime/socket');

let client = null;
let invalidMessages = 0;

// Turn an MQTT wildcard pattern such as smartchair/+/sensors into a RegExp.
function topicPatternToRegex(pattern) {
  const escaped = pattern.split('/').map((part) => {
    if (part === '+') return '([^/]+)';
    if (part === '#') return '(.+)';
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${escaped.join('/')}$`);
}

const sensorTopicRegex = topicPatternToRegex(config.mqtt.sensorTopic);
const calibrationTopicRegex = topicPatternToRegex(config.mqtt.calibrationTopic);

async function handleSensorMessage(payload) {
  const { reading, error } = sessionService.validatePayload(payload);
  if (error) {
    invalidMessages += 1;
    console.warn(`[mqtt] dropped invalid sensor message: ${error}`);
    return;
  }
  await sessionService.processReading(reading);
}

async function handleCalibrationMessage(payload, deviceIdFromTopic) {
  if (!payload || typeof payload !== 'object') return;
  const deviceId = payload.device_id || deviceIdFromTopic;
  if (!deviceId) return;
  await CalibrationSetting.create({
    deviceId,
    calibratedDistanceCm: Number.isFinite(Number(payload.calibrated_distance_cm))
      ? Number(payload.calibrated_distance_cm)
      : null,
    values: payload,
    calibratedAt: payload.timestamp ? new Date(payload.timestamp) : new Date()
  });
  realtime.emit('calibration-updated', { deviceId });
}

// Publish a command to one device, e.g. publishCommand('chair_01', { type: 'threshold-updated', ... })
function publishCommand(deviceId, command) {
  if (!client || !client.connected) return false;
  const topic = config.mqtt.commandTopicPattern.replace('{deviceId}', deviceId);
  client.publish(topic, JSON.stringify(command), { qos: 1 });
  return true;
}

function start() {
  client = mqtt.connect(config.mqtt.brokerUrl, {
    clientId: `${config.mqtt.clientId}-${Math.random().toString(16).slice(2, 8)}`,
    username: config.mqtt.username,
    password: config.mqtt.password,
    reconnectPeriod: 3000, // automatic reconnect on broker drop
    connectTimeout: 10000
  });

  client.on('connect', () => {
    console.log(`[mqtt] connected to ${config.mqtt.brokerUrl}`);
    liveStatus.setMqttConnected(true);
    client.subscribe([config.mqtt.sensorTopic, config.mqtt.calibrationTopic], (err) => {
      if (err) console.error('[mqtt] subscribe failed:', err.message);
      else console.log(`[mqtt] subscribed to ${config.mqtt.sensorTopic} and ${config.mqtt.calibrationTopic}`);
    });
  });

  client.on('reconnect', () => console.log('[mqtt] reconnecting...'));
  client.on('close', () => liveStatus.setMqttConnected(false));
  client.on('error', (err) => console.error('[mqtt] error:', err.message));

  client.on('message', (topic, message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      invalidMessages += 1;
      console.warn(`[mqtt] dropped non-JSON message on ${topic}`);
      return;
    }
    const sensorMatch = topic.match(sensorTopicRegex);
    const calibrationMatch = topic.match(calibrationTopicRegex);
    if (sensorMatch) {
      handleSensorMessage(payload).catch((err) => console.error('[mqtt] processing failed:', err));
    } else if (calibrationMatch) {
      handleCalibrationMessage(payload, calibrationMatch[1]).catch((err) => console.error('[mqtt] calibration save failed:', err));
    }
  });

  return client;
}

function stats() {
  return { connected: Boolean(client && client.connected), invalidMessages };
}

module.exports = { start, publishCommand, stats };
