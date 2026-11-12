import { API_URL, TZ_OFFSET } from '../config';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', params, body } = {}) {
  const url = new URL(API_URL + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_URL}. Is it running?`, 0, 'NETWORK');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data?.error);
  return data;
}

export const api = {
  liveStatus: (deviceId) => request('/api/live-status', { params: { device_id: deviceId } }),
  readings: (p) => request('/api/sensor-readings', { params: p }),
  sessions: (p) => request('/api/sessions', { params: p }),
  session: (id) => request(`/api/sessions/${id}`),
  breakEvents: (p) => request('/api/break-events', { params: p }),
  ackBreak: (id) => request(`/api/break-events/${id}/acknowledge`, { method: 'POST' }),
  daily: (p) => request('/api/analytics/daily', { params: { tz_offset_minutes: TZ_OFFSET, ...p } }),
  weekly: (p) => request('/api/analytics/weekly', { params: { tz_offset_minutes: TZ_OFFSET, ...p } }),
  settings: () => request('/api/settings'),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }),
  latestCalibration: (deviceId) => request('/api/calibration/latest', { params: { device_id: deviceId } })
};

// Fetch every reading in a time window (newest-first pages), returned oldest-first.
export async function fetchReadings(deviceId, from, to, maxPages = 5) {
  const all = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const r = await api.readings({ device_id: deviceId, from, to, page, limit: 200 });
    total = r.total;
    all.push(...r.items);
    if (all.length >= total || r.items.length === 0) break;
  }
  return { items: all.reverse(), total, truncated: all.length < total };
}
