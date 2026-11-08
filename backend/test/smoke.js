/**
 * End-to-end smoke test, no hardware and no external services needed:
 * spins up an in-memory MongoDB and an embedded MQTT broker (aedes),
 * starts the real backend, publishes a scripted sitting session like the
 * ESP32 would, then checks storage, sessions, breaks, REST APIs and
 * real-time Socket.IO events.
 */
process.env.PORT = process.env.PORT || '0';
process.env.BREAK_THRESHOLD_SECONDS = '15';
process.env.CORS_ORIGIN = '*';

const net = require('net');
const assert = require('node:assert');

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const Aedes = require('aedes');
  const mqtt = require('mqtt');
  const { io: ioc } = require('socket.io-client');

  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('smartchair-test');

  const aedes = new Aedes();
  const broker = net.createServer(aedes.handle);
  await new Promise((r) => broker.listen(0, r));
  process.env.MQTT_BROKER_URL = `mqtt://127.0.0.1:${broker.address().port}`;

  const { start } = require('../src/server');
  const { server } = await start();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  // Real-time listener must be connected before readings arrive.
  const events = [];
  const socket = ioc(base, { transports: ['websocket'] });
  for (const name of ['live-status', 'session-started', 'posture-warning', 'break-reminder', 'session-ended']) {
    socket.on(name, (payload) => events.push({ name, payload }));
  }
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  ok('socket.io client connected', true);

  // Publish a scripted session with simulated timestamps 5s apart.
  const pub = mqtt.connect(process.env.MQTT_BROKER_URL);
  await new Promise((r) => pub.on('connect', r));
  ok('backend and publisher connected to MQTT broker', true);

  const t0 = Date.now() - 90 * 1000;
  const steps = [
    { is_seated: false, posture_status: 'not_seated', distance_cm: 10, sitting_duration_seconds: 0 },
    { is_seated: true, posture_status: 'sitting_straight', distance_cm: 35, sitting_duration_seconds: 0 },
    { is_seated: true, posture_status: 'sitting_straight', distance_cm: 35.4, sitting_duration_seconds: 5 },
    { is_seated: true, posture_status: 'slouching', distance_cm: 27, sitting_duration_seconds: 10 },
    { is_seated: true, posture_status: 'slouching', distance_cm: 26, sitting_duration_seconds: 15 }, // break threshold 15s crossed here
    { is_seated: true, posture_status: 'slouching', distance_cm: 26.5, sitting_duration_seconds: 20 },
    { is_seated: true, posture_status: 'sitting_straight', distance_cm: 35.2, sitting_duration_seconds: 25 },
    { is_seated: false, posture_status: 'not_seated', distance_cm: 12, sitting_duration_seconds: 0 }
  ];
  const publish = (topic, payload) => new Promise((r) => pub.publish(topic, JSON.stringify(payload), r));
  for (let i = 0; i < steps.length; i++) {
    await publish('smartchair/chair_01/sensors', {
      device_id: 'chair_01',
      timestamp: new Date(t0 + i * 5000).toISOString(),
      break_required: steps[i].sitting_duration_seconds >= 15,
      ...steps[i]
    });
  }
  // Invalid messages must be dropped safely, not stored.
  await publish('smartchair/chair_01/sensors', 'this is not json');
  await publish('smartchair/chair_01/sensors', { device_id: 'chair_01' }); // missing is_seated
  await publish('smartchair/chair_01/calibration', { device_id: 'chair_01', calibrated_distance_cm: 35 });

  // Wait until the backend has closed the session.
  const deadline = Date.now() + 10000;
  let closed = false;
  while (Date.now() < deadline) {
    const sessionsNow = await (await fetch(`${base}/api/sessions?device_id=chair_01`)).json();
    if (sessionsNow.total === 1 && sessionsNow.items[0].endTime) { closed = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  ok('session closed after user stood up (within timeout)', closed);
  const live = await (await fetch(`${base}/api/live-status?device_id=chair_01`)).json();

  const readings = await (await fetch(`${base}/api/sensor-readings?device_id=chair_01&limit=100`)).json();
  ok('all 8 valid readings stored, invalid ones dropped', readings.total === 8);

  const sessions = await (await fetch(`${base}/api/sessions?device_id=chair_01`)).json();
  ok('exactly one session (no duplicates)', sessions.total === 1);
  const session = sessions.items[0];
  ok('session started when user sat and ended when they stood', Boolean(session.startTime) && Boolean(session.endTime));
  ok('session duration ~30s', session.durationSeconds === 30);
  ok('slouching time tracked (~15s)', session.slouchingSeconds === 15);
  ok('posture warning counted once on slouch transition', session.postureWarnings === 1);
  ok('one break reminder recorded (no duplicates after threshold)', session.breakReminders === 1);

  const detail = await (await fetch(`${base}/api/sessions/${session._id}`)).json();
  ok('session detail includes break events', Array.isArray(detail.breakEvents) && detail.breakEvents.length === 1);

  const breaks = await (await fetch(`${base}/api/break-events?device_id=chair_01`)).json();
  ok('break event stored with sitting duration', breaks.total === 1 && breaks.items[0].sittingDurationSeconds === 15);
  ok('break marked taken when user stood up', breaks.items[0].breakTaken === true);

  ok('live-status back to not seated', live.isSeated === false && live.sessionId === null);

  const daily = await (await fetch(`${base}/api/analytics/daily?device_id=chair_01`)).json();
  ok('daily analytics from real records', daily.sessions === 1 && daily.sittingSeconds === 30 && daily.breaksTaken === 1);

  const weekly = await (await fetch(`${base}/api/analytics/weekly?device_id=chair_01`)).json();
  ok('weekly analytics returns 7 days with totals', weekly.days.length === 7 && weekly.totals.sessions === 1);

  const settings1 = await (await fetch(`${base}/api/settings`)).json();
  ok('settings default threshold from env', settings1.breakThresholdSeconds === 15);
  const putRes = await fetch(`${base}/api/settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ breakThresholdSeconds: 90 })
  });
  ok('PUT /api/settings updates threshold', putRes.status === 200 && (await putRes.json()).breakThresholdSeconds === 90);
  const badPut = await fetch(`${base}/api/settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ breakThresholdSeconds: 'loud' })
  });
  ok('PUT /api/settings rejects invalid threshold', badPut.status === 400);

  const calRes = await fetch(`${base}/api/calibration`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'chair_01', calibrated_distance_cm: 35 })
  });
  ok('POST /api/calibration saves', calRes.status === 201);
  const latestCal = await fetch(`${base}/api/calibration/latest?device_id=chair_01`);
  ok('GET /api/calibration/latest works', latestCal.status === 200);
  const badCal = await fetch(`${base}/api/calibration`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
  });
  ok('POST /api/calibration validates device_id', badCal.status === 400);

  const eventNames = events.map((e) => e.name);
  ok('realtime: live-status broadcast on readings', eventNames.includes('live-status'));
  ok('realtime: session-started emitted', eventNames.includes('session-started'));
  ok('realtime: posture-warning emitted', eventNames.includes('posture-warning'));
  ok('realtime: break-reminder emitted', eventNames.includes('break-reminder'));
  ok('realtime: session-ended emitted', eventNames.includes('session-ended'));

  // --- Out-of-order readings: sit -> stand -> delayed sit must not reopen a session ---
  const waitFor = async (fn, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); }
    return false;
  };
  const getJson = async (path) => (await fetch(`${base}${path}`)).json();
  const base2 = Date.now() - 60 * 1000;
  const dev = 'chair_02';
  const send = (offsetSec, extra) => publish(`smartchair/${dev}/sensors`, {
    device_id: dev, timestamp: new Date(base2 + offsetSec * 1000).toISOString(), distance_cm: 35, sitting_duration_seconds: 0, ...extra
  });
  await send(0, { is_seated: true, posture_status: 'sitting_straight' });
  await send(10, { is_seated: false, posture_status: 'not_seated' });
  await waitFor(async () => (await getJson(`/api/sessions?device_id=${dev}`)).items.some((x) => x.endTime));
  await send(5, { is_seated: true, posture_status: 'sitting_straight' }); // delayed "seated" from before the stand
  await send(11, { is_seated: false, posture_status: 'not_seated' }); // newer in-order reading, used as a barrier
  await waitFor(async () => (await getJson(`/api/live-status?device_id=${dev}`)).lastMessageAt === new Date(base2 + 11000).toISOString());
  const s2 = await getJson(`/api/sessions?device_id=${dev}`);
  ok('delayed old seated reading creates no phantom session', s2.total === 1 && Boolean(s2.items[0].endTime));
  ok('session duration is not inflated by the delayed reading', s2.items[0].durationSeconds === 10);
  const live2 = await getJson(`/api/live-status?device_id=${dev}`);
  ok('live status stays not seated after the delayed reading', live2.isSeated === false && live2.sessionId === null);
  const r2 = await getJson(`/api/sensor-readings?device_id=${dev}&limit=100`);
  ok('out-of-order reading is not stored (3 in-order readings only)', r2.total === 3);
  await send(30, { is_seated: true, posture_status: 'sitting_straight' }); // a genuinely new sit still works
  await waitFor(async () => (await getJson(`/api/sessions?device_id=${dev}`)).total === 2);
  ok('a genuinely newer seated reading still starts a new session', (await getJson(`/api/sessions?device_id=${dev}`)).total === 2);

  // --- LED / buzzer: expected (backend-calculated) vs reported (device telemetry) ---
  const live3 = await getJson(`/api/live-status?device_id=${dev}`);
  ok('live status exposes expected LED/buzzer, not a bare ledOn/buzzerOn', 'expectedLedOn' in live3 && 'expectedBuzzerOn' in live3 && !('ledOn' in live3) && !('buzzerOn' in live3));
  ok('reported LED/buzzer stay null when the device does not report them', live3.reportedLedOn === null && live3.reportedBuzzerOn === null);
  await send(35, { is_seated: true, posture_status: 'slouching', led_on: true, buzzer_on: false });
  await waitFor(async () => (await getJson(`/api/live-status?device_id=${dev}`)).reportedLedOn === true);
  const live4 = await getJson(`/api/live-status?device_id=${dev}`);
  ok('device-reported LED/buzzer telemetry is passed through', live4.reportedLedOn === true && live4.reportedBuzzerOn === false && live4.expectedLedOn === true);

  const unknown = await fetch(`${base}/api/nope`);
  ok('unknown route returns clean 404', unknown.status === 404);

  console.log(`\n${passed} checks passed`);
  socket.close();
  pub.end();
  await new Promise((r) => server.close(r));
  await require('mongoose').disconnect();
  await mongo.stop();
  broker.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err.message);
  process.exit(1);
});
