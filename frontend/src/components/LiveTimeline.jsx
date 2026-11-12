import { useMemo } from 'react';
import { api, fetchReadings } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useNow } from '../hooks/useNow';
import { readingToPoint } from '../utils/timeline';
import Timeline from './Timeline';

// Timeline of the current sitting session: stored readings plus what arrived live.
export default function LiveTimeline({ live, state }) {
  const now = useNow(1000);
  const sid = state && state.isSeated ? state.sessionId : null;
  const dev = live.activeId || undefined;

  const hist = useAsync(async () => {
    if (!sid) return null;
    const session = await api.session(sid);
    const readings = await fetchReadings(session.deviceId, session.startTime);
    return { session, readings };
  }, [sid, dev]);

  const startMs = state && state.sessionStartTime ? Date.parse(state.sessionStartTime) : null;

  const points = useMemo(() => {
    const fetched = hist.data ? hist.data.readings.items.map(readingToPoint) : [];
    const lastTs = fetched.length ? fetched[fetched.length - 1].ts : 0;
    const fresh = live.trail.filter((p) => p.ts > lastTs && (startMs == null || p.ts >= startMs));
    return [...fetched, ...fresh.map(({ ts, posture }) => ({ ts, posture }))];
  }, [hist.data, live.trail, startMs]);

  const breakTimes = useMemo(() => {
    const stored = hist.data ? hist.data.session.breakEvents.map((b) => Date.parse(b.timestamp)) : [];
    const seen = new Set(stored.map((t) => Math.round(t / 5000)));
    const extra = live.breakMarks.filter((t) => !seen.has(Math.round(t / 5000)) && (startMs == null || t >= startMs));
    return [...stored, ...extra];
  }, [hist.data, live.breakMarks, startMs]);

  if (!sid) return <p className="empty">The timeline starts when someone sits down.</p>;
  if (hist.error) return <p className="err">{hist.error.message} <button className="linkbtn" onClick={hist.reload}>Try again</button></p>;

  const note = hist.data && hist.data.readings.truncated
    ? `Showing the latest ${hist.data.readings.items.length} of ${hist.data.readings.total} readings.` : null;
  return <Timeline points={points} endMs={now} startMs={startMs} breakTimes={breakTimes} note={note} />;
}
