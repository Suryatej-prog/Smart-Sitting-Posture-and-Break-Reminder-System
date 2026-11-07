# Smart Sitting Posture Monitoring and Break Reminder System - Backend

Backend for the IoT mini project. Receives sensor readings from an ESP32 over
MQTT, stores them in MongoDB, tracks sitting sessions and break reminders, and
serves REST APIs plus Socket.IO real-time updates for the frontend dashboard.

Flow: Sensors -> ESP32 -> MQTT -> this backend -> MongoDB -> Frontend dashboard

## Stack

- Node.js + Express (REST APIs)
- MongoDB + Mongoose (storage)
- mqtt.js (MQTT client, auto-reconnect)
- Socket.IO (real-time dashboard updates)
- dotenv, cors

## Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm start              # or: npm run dev
```

You need a MongoDB server and an MQTT broker running. Locally, Docker works:

```bash
docker run -d -p 27017:27017 mongo:7
docker run -d -p 1883:1883 eclipse-mosquitto:2
```

## Testing without hardware

```bash
npm test            # full end-to-end smoke test (in-memory MongoDB + embedded MQTT broker, nothing to install)
npm run publish:fake   # publishes a fake sitting session to the broker in .env
```

The smoke test verifies: MQTT connect/receive, valid readings stored, invalid
messages dropped, session start/end without duplicates, slouching time,
posture warnings, one break event per threshold crossing, every REST endpoint,
and the real-time Socket.IO events.

## MQTT contract (finalize with the ESP32 developer)

| Direction | Topic | Payload |
| --- | --- | --- |
| ESP32 -> backend | `smartchair/{deviceId}/sensors` | sensor reading JSON (below) |
| ESP32 -> backend | `smartchair/{deviceId}/calibration` | calibration JSON |
| backend -> ESP32 | `smartchair/{deviceId}/commands` | commands, e.g. threshold updates |

Sensor reading payload:

```json
{
  "device_id": "chair_01",
  "timestamp": "2026-11-06T12:00:00Z",
  "is_seated": true,
  "distance_cm": 35.5,
  "posture_status": "slouching",
  "sitting_duration_seconds": 120,
  "break_required": false
}
```

`device_id` and `is_seated` are required; anything invalid is logged and
dropped, never stored. `posture_status` is one of `sitting_straight`,
`slouching`, `not_seated` (the ESP32 decides posture; the backend records it).
Topic names and the broker URL are configurable in `.env`.

## REST API

Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/live-status?device_id=` | Current seat/posture/distance/duration/break state |
| GET | `/api/sensor-readings?device_id=&from=&to=&page=&limit=` | Historical readings, paginated |
| GET | `/api/sessions?device_id=&from=&to=&page=&limit=` | Past sitting sessions |
| GET | `/api/sessions/:id` | One session incl. its break events |
| GET | `/api/break-events?device_id=&from=&to=&page=&limit=` | Break reminder history |
| POST | `/api/break-events/:id/acknowledge` | "I've taken a break" button |
| GET | `/api/analytics/daily?date=&device_id=&tz_offset_minutes=` | Sitting/slouching/warnings/breaks for one day |
| GET | `/api/analytics/weekly?end=&device_id=&tz_offset_minutes=` | Last 7 days, per-day + totals |
| GET | `/api/settings` | Current configuration |
| PUT | `/api/settings` | Update break threshold, sound, theme, etc. |
| POST | `/api/calibration` | Save a calibration record |
| GET | `/api/calibration/latest?device_id=` | Latest calibration |

All list endpoints return `{ page, limit, total, items }`. Analytics take an
optional `tz_offset_minutes` (e.g. `330` for IST) so "today" matches local time.

## Real-time events (Socket.IO)

Connect to the server URL and listen for:

- `live-status` - full latest state for a device, on every valid reading
- `session-started` / `session-ended`
- `posture-warning` - user started slouching
- `break-reminder` - sitting threshold crossed
- `calibration-updated`

## Business logic

- A session opens on the first seated reading and closes when the user stands.
  A unique index guarantees at most one open session per device, and readings
  are processed in order per device, so duplicates cannot occur.
- Slouching time accumulates between readings while posture is `slouching`;
  a posture warning counts each transition into slouching.
- When continuous sitting passes `breakThresholdSeconds` (default 60 for the
  demo, changeable via `PUT /api/settings`), exactly one break event is
  recorded per session. It is marked taken when the user stands up or the
  dashboard acknowledges it.
- After a server restart, live state is rebuilt from MongoDB so the dashboard
  never shows a stale session as live.

## Project structure

```
backend/
  src/
    config/       env loading
    models/       Mongoose schemas (SensorReading, SittingSession, BreakEvent, CalibrationSetting, Settings)
    mqtt/         broker connection, subscriptions, command publishing
    services/     session/break business logic, settings cache, live state
    controllers/  request handlers
    routes/       API routes
    realtime/     Socket.IO setup
    middleware/   404 + error handling
    app.js        Express app
    server.js     startup (DB, MQTT, HTTP, Socket.IO)
  scripts/fake-publisher.js   fake ESP32 for demos/tests
  test/smoke.js               end-to-end test
```
