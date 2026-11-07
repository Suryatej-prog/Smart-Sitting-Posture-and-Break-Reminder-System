/**
 * Fake ESP32 publisher. Simulates a full sitting session over MQTT so the
 * backend can be tested without hardware:
 *   not seated -> sits down (straight) -> slouches -> straight again ->
 *   crosses the break threshold -> stands up.
 *
 * Simulated timestamps are spaced SIM_STEP_SECONDS apart so a full demo,
 * including the 60 second break reminder, runs in a few real seconds.
 *
 * Usage:
 *   node scripts/fake-publisher.js [--device chair_01] [--realtime]
 * Env:
 *   MQTT_BROKER_URL (default mqtt://localhost:1883)
 */
require('dotenv').config();
const mqtt = require('mqtt');

const args = process.argv.slice(2);
const deviceId = args.includes('--device') ? args[args.indexOf('--device') + 1] : 'chair_01';
const realtime = args.includes('--realtime');
const BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const SIM_STEP_SECONDS = 5;
const PUBLISH_INTERVAL_MS = realtime ? SIM_STEP_SECONDS * 1000 : 800;
const BASE_DISTANCE = 35;

// [isSeated, posture, distanceCm]
const SCRIPT = [
  [false, 'not_seated', 10],
  [true, 'sitting_straight', BASE_DISTANCE],
  [true, 'sitting_straight', BASE_DISTANCE + 0.4],
  [true, 'slouching', BASE_DISTANCE - 8],
  [true, 'slouching', BASE_DISTANCE - 9],
  [true, 'sitting_straight', BASE_DISTANCE + 0.2],
  [true, 'sitting_straight', BASE_DISTANCE],
  [true, 'sitting_straight', BASE_DISTANCE + 0.6],
  [true, 'sitting_straight', BASE_DISTANCE - 0.3],
  [true, 'sitting_straight', BASE_DISTANCE + 0.1],
  [true, 'slouching', BASE_DISTANCE - 8.5],
  [true, 'slouching', BASE_DISTANCE - 8],
  [true, 'sitting_straight', BASE_DISTANCE],
  [true, 'sitting_straight', BASE_DISTANCE + 0.3],
  [true, 'sitting_straight', BASE_DISTANCE],
  [false, 'not_seated', 12]
];

const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log(`Publishing fake readings to ${BROKER} as device "${deviceId}" (${PUBLISH_INTERVAL_MS}ms apart)`);
  const simStart = Date.now();
  let sittingSeconds = 0;
  let step = 0;

  const timer = setInterval(() => {
    if (step >= SCRIPT.length) {
      clearInterval(timer);
      const cal = {
        device_id: deviceId,
        timestamp: new Date(simStart + step * SIM_STEP_SECONDS * 1000).toISOString(),
        calibrated_distance_cm: BASE_DISTANCE
      };
      client.publish(`smartchair/${deviceId}/calibration`, JSON.stringify(cal), () => {
        console.log('Done. Published calibration reading and exiting.');
        client.end();
      });
      return;
    }
    const [isSeated, posture, distance] = SCRIPT[step];
    if (isSeated && step > 0 && SCRIPT[step - 1][0]) sittingSeconds += SIM_STEP_SECONDS;
    else if (isSeated) sittingSeconds = 0;
    const reading = {
      device_id: deviceId,
      timestamp: new Date(simStart + step * SIM_STEP_SECONDS * 1000).toISOString(),
      is_seated: isSeated,
      distance_cm: distance,
      posture_status: posture,
      sitting_duration_seconds: sittingSeconds,
      break_required: sittingSeconds >= 60
    };
    client.publish(`smartchair/${deviceId}/sensors`, JSON.stringify(reading));
    console.log(`#${step + 1} seated=${isSeated} posture=${posture} sitting=${sittingSeconds}s`);
    step += 1;
  }, PUBLISH_INTERVAL_MS);
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
  process.exit(1);
});
