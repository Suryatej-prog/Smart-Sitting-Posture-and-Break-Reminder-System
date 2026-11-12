import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useLive } from '../context/LiveContext';
import { useAsync } from '../hooks/useAsync';
import Async from '../components/Async';
import { dateOf, dur, pct, timeOf } from '../utils/format';

const LIMIT = 15;

export default function Sessions() {
  const live = useLive();
  const [page, setPage] = useState(1);
  const data = useAsync(
    () => api.sessions({ device_id: live.activeId || undefined, page, limit: LIMIT }),
    [page, live.activeId, live.sessionTick]
  );

  return (
    <>
      <div className="head"><h1>Sessions</h1></div>
      <Async state={data}>
        {({ items, total }) => {
          if (total === 0) return <p className="empty">No sitting sessions yet. Sit down on the chair and they will show up here.</p>;
          const pages = Math.max(1, Math.ceil(total / LIMIT));
          return (
            <>
              <div className="table" role="table">
                <div className="trow thead" role="row">
                  <span>Started</span><span>Ended</span><span>Duration</span>
                  <span className="hide-sm">Good posture</span><span className="hide-sm">Slouching</span>
                  <span>Warnings</span><span className="hide-sm">Reminders</span>
                </div>
                {items.map((s) => {
                  const good = Math.max(0, s.durationSeconds - s.slouchingSeconds);
                  return (
                    <Link key={s._id} to={`/sessions/${s._id}`} className="trow" role="row">
                      <span>{dateOf(s.startTime)}<small>{timeOf(s.startTime, false)}</small></span>
                      <span>{s.endTime ? timeOf(s.endTime, false) : <em className="good">In progress</em>}</span>
                      <span className="num">{dur(s.durationSeconds)}</span>
                      <span className="num hide-sm">{dur(good)} <small>{pct(good, s.durationSeconds)}%</small></span>
                      <span className="num hide-sm">{dur(s.slouchingSeconds)}</span>
                      <span className="num">{s.postureWarnings}</span>
                      <span className="num hide-sm">{s.breakReminders}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="pager">
                <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
                <span className="muted">Page {page} of {pages}</span>
                <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</button>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
