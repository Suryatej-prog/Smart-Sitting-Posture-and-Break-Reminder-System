# Upright: frontend

Dashboard for the Smart Sitting Posture Monitoring and Break Reminder System.
React + Vite, plain CSS, Recharts for charts, socket.io-client for live data.
It talks to the existing backend (`../backend`) and uses **no mock or random data**.

## Run it

```bash
# 1. backend (in a terminal)
cd backend && npm install && cp .env.example .env && npm start

# 2. frontend (another terminal)
cd frontend
npm install
cp .env.example .env      # only edit if your backend is not on localhost:5000
npm run dev               # http://localhost:5173
```

No hardware yet? With the backend running, `npm run publish:fake` (inside `backend/`)
acts as a fake ESP32 so you can watch the dashboard react.

If you set `CORS_ORIGIN` in the backend `.env`, set it to `http://localhost:5173`
(or leave it as `*`).

## Settings in `.env`

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Backend address (REST and Socket.IO) |
| `VITE_DEVICE_ID` | empty | Lock to one device. Empty = auto-pick, with a switcher on the Device page |
| `VITE_STALE_SECONDS` | `8` | Seconds without a sensor message before the device shows as disconnected. Keep it above 2x the ESP32 publish interval |

## Pages

| Route | What it shows |
| --- | --- |
| `/` Live | Posture state, sitting timer, break countdown, session timeline, today's score, insights, achievements, sensors, LED and buzzer |
| `/analytics` | Last 7/14/30 days or a custom range (up to 31 days): sitting time, score trend, warnings and breaks, sessions |
| `/sessions`, `/sessions/:id` | Session history and per-session timeline and break reminders |
| `/device` | Connection, MQTT status, sensor health, device switcher |
| `/settings` | Break threshold, sound, volume, full-screen warning, theme, calibration status |

## How it handles live data

- Live state arrives over Socket.IO (`live-status`, `posture-warning`, `break-reminder`, `session-started`, `session-ended`).
- If no message arrives for `VITE_STALE_SECONDS`, the page switches to "Device disconnected" and
  **stops showing sensor values**. Old readings are never presented as live.
- The sitting timer ticks locally between messages, starting from the last reported value.
- The LED and buzzer show only what the ESP32 reports (`led_on`, `buzzer_on`). If it doesn't report
  them, the page says "Not reported" and notes what the rules expect.
- Browser sounds are generated in the browser. They play once per warning event, never faster than the
  cooldown set on the Settings page, and only after the browser allows audio (any click unlocks it).

## Posture score

Defined in `src/utils/score.js` and explained on the dashboard.
`score = 100 x (0.70 x good-posture share + 0.20 x breaks taken / reminders + 0.10 x warning rate factor)`.
No sitting data means no score.

## Folder layout

```
src/
  api/        REST client
  audio/      alert sounds (Web Audio)
  components/ hero, timeline, overlays, charts helpers
  context/    live data store and derived view (stale detection)
  hooks/      data and timer hooks
  pages/      Dashboard, Analytics, Sessions, SessionDetail, Device, Settings
  styles/     global.css (all theme colours are variables at the top)
  utils/      formatting, score, insights, achievements, timeline
```

## Limits that come from the backend

- Seat detection is occupied or empty. The backend has no raw FSR pressure value to chart.
- Calibration can be viewed here, but only the chair's push button starts it.
- Only one break reminder is created per sitting session.
