import { Link, useParams } from 'react-router-dom';
import { api, fetchReadings } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import Async from '../components/Async';
import Timeline from '../components/Timeline';
import { readingToPoint } from '../utils/timeline';
import { dateOf, dur, pct, timeOf } from '../utils/format';

export default function SessionDetail() {
  const { id } = useParams();
  const data = useAsync(async () => {
    const s = await api.session(id);
    const r = await fetchReadings(s.deviceId, s.startTime, s.endTime || undefined);
    return { s, r };
  }, [id]);

  return (
    <>
      <p><Link to="/sessions" className="back">Back to sessions</Link></p>
      <Async state={data}>
        {({ s, r }) => {
          const good = Math.max(0, s.durationSeconds - s.slouchingSeconds);
          const points = r.items.map(readingToPoint);
          const endMs = s.endTime ? Date.parse(s.endTime) : Date.now();
          const taken = s.breakEvents.filter((b) => b.breakTaken).length;
          const stats = [
            ['Started', timeOf(s.startTime, false)],
            ['Ended', s.endTime ? timeOf(s.endTime, false) : 'In progress'],
            ['Duration', dur(s.durationSeconds)],
            ['Good posture', `${dur(good)} (${pct(good, s.durationSeconds)}%)`],
            ['Slouching', dur(s.slouchingSeconds)],
            ['Warnings', s.postureWarnings],
            ['Breaks taken', `${taken} of ${s.breakReminders} reminder${s.breakReminders === 1 ? '' : 's'}`]
          ];
          return (
            <>
              <div className="head"><h1>{dateOf(s.startTime)}</h1><span className="muted">{s.deviceId}</span></div>
              <dl className="stats wide">
                {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
              </dl>
              <section className="block">
                <h2>Posture timeline</h2>
                <Timeline
                  points={points}
                  endMs={endMs}
                  startMs={Date.parse(s.startTime)}
                  breakTimes={s.breakEvents.map((b) => Date.parse(b.timestamp))}
                  note={r.truncated ? `Showing the latest ${r.items.length} of ${r.total} readings.` : null}
                />
              </section>
              <section className="block">
                <h2>Break reminders</h2>
                {s.breakEvents.length === 0 ? <p className="empty">No break reminder fired in this session.</p> : (
                  <ul className="plain">
                    {s.breakEvents.map((b) => (
                      <li key={b._id}>
                        <span>Reminder at {timeOf(b.timestamp)} after {dur(b.sittingDurationSeconds)} of sitting</span>
                        <span className={b.breakTaken ? 'good' : 'muted'}>
                          {b.breakTaken ? `Break taken at ${timeOf(b.breakTakenAt)}` : 'No break taken'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </Async>
    </>
  );
}
