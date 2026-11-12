import { api } from '../api/client';
import { useAsync } from './useAsync';
import { dayKey, isoNoon } from '../utils/format';

// Today's summary, the last 7 days, recent sessions and break events for one device.
export function useOverview(deviceId, tick) {
  return useAsync(async () => {
    const today = isoNoon(dayKey());
    const device_id = deviceId || undefined;
    const [daily, weekly, sessions, breaks] = await Promise.all([
      api.daily({ date: today, device_id }),
      api.weekly({ end: today, device_id }),
      api.sessions({ device_id, limit: 200 }),
      api.breakEvents({ device_id, limit: 200 })
    ]);
    return { daily, weekly, sessions: sessions.items, breaks: breaks.items };
  }, [deviceId, tick]);
}
