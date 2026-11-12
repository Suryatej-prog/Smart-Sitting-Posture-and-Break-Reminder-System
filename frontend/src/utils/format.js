export const pad = (n) => String(n).padStart(2, '0');

// 83 -> "01:23", 3725 -> "1:02:05"
export function clock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

// 83 -> "1m 23s", 3725 -> "1h 02m"
export function dur(sec) {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${pad(m)}m`;
  return s % 60 ? `${m}m ${pad(s % 60)}s` : `${m}m`;
}

export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export const timeOf = (v, seconds = true) =>
  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });

export const dateOf = (v) => new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

export const dateTimeOf = (v) => `${dateOf(v)}, ${timeOf(v, false)}`;

export function ago(ms) {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// Local calendar day as YYYY-MM-DD
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function addDays(key, n) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// Noon UTC keeps the backend's day calculation on the intended calendar day in any timezone.
export const isoNoon = (key) => `${key}T12:00:00Z`;

export const shortDay = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });

export const STATUS_LABEL = {
  sitting_straight: 'Sitting straight',
  slouching: 'Slouching',
  not_seated: 'Not seated',
  unknown: 'Seated',
  nodata: 'No data'
};
