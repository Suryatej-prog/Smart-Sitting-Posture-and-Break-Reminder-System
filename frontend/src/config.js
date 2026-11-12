export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
export const FIXED_DEVICE_ID = import.meta.env.VITE_DEVICE_ID || '';
export const STALE_MS = (Number(import.meta.env.VITE_STALE_SECONDS) || 8) * 1000;
// Minutes east of UTC (IST = 330). Sent to analytics so "today" matches local time.
export const TZ_OFFSET = -new Date().getTimezoneOffset();
