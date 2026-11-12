import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { useLive } from '../context/LiveContext';
import { useAsync } from '../hooks/useAsync';
import Async from '../components/Async';
import { addDays, dateTimeOf, dayKey, dur, isoNoon, pct, shortDay } from '../utils/format';
import { averageScore, postureScore } from '../utils/score';

const rangeKeys = (from, to) => {
  const keys = [];
  for (let k = from; k <= to && keys.length < 400; k = addDays(k, 1)) keys.push(k);
  return keys;
};
const mins = (s) => Math.round(s / 6) / 10;
const tick = { fill: 'var(--muted)', fontSize: 12 };

function Tip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tip">
      <b>{label}</b>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <i className="dot" style={{ background: p.color }} />
          {p.name}: {p.value == null ? 'no data' : `${p.value}${unit ? ` ${unit}` : ''}`}
        </div>
      ))}
    </div>
  );
}

function Chart({ title, children, height = 260 }) {
  return (
    <section className="block">
      <h2>{title}</h2>
      <div className="chart"><ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer></div>
    </section>
  );
}

export default function Analytics() {
  const live = useLive();
  const today = dayKey();
  const [preset, setPreset] = useState('7');
  const [applied, setApplied] = useState({ from: addDays(today, -6), to: today });
  const [cFrom, setCFrom] = useState(addDays(today, -6));
  const [cTo, setCTo] = useState(today);
  const [rangeErr, setRangeErr] = useState(null);

  function pick(p) {
    setPreset(p);
    setRangeErr(null);
    if (p !== 'custom') setApplied({ from: addDays(today, -(Number(p) - 1)), to: today });
  }
  function applyCustom() {
    if (!cFrom || !cTo || cFrom > cTo) return setRangeErr('Choose a start date on or before the end date.');
    if (cTo > today) return setRangeErr("The end date can't be in the future.");
    if (rangeKeys(cFrom, cTo).length > 31) return setRangeErr('Choose 31 days or fewer.');
    setRangeErr(null);
    setApplied({ from: cFrom, to: cTo });
  }

  const data = useAsync(async () => {
    const device_id = live.activeId || undefined;
    const keys = rangeKeys(applied.from, applied.to);
    let rows;
    if (keys.length === 7 && applied.to === today) {
      const w = await api.weekly({ end: isoNoon(today), device_id });
      rows = keys.map((k, i) => ({ ...w.days[i], date: k }));
    } else {
      rows = await Promise.all(keys.map((k) => api.daily({ date: isoNoon(k), device_id }).then((r) => ({ ...r, date: k }))));
    }
    const sess = await api.sessions({
      device_id, limit: 100,
      from: new Date(`${applied.from}T00:00:00`).toISOString(),
      to: new Date(`${applied.to}T23:59:59.999`).toISOString()
    });
    return { rows, sessions: sess.items, sessionTotal: sess.total };
  }, [applied.from, applied.to, live.activeId]);

  return (
    <>
      <div className="head">
        <h1>Analytics</h1>
        <div className="seg-ctl" role="group" aria-label="Date range">
          {[['7', 'Last 7 days'], ['14', 'Last 14 days'], ['30', 'Last 30 days'], ['custom', 'Custom']].map(([k, l]) => (
            <button key={k} className={preset === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="custom">
          <label>From <input type="date" value={cFrom} max={today} onChange={(e) => setCFrom(e.target.value)} /></label>
          <label>To <input type="date" value={cTo} max={today} onChange={(e) => setCTo(e.target.value)} /></label>
          <button className="btn" onClick={applyCustom}>Apply</button>
          {rangeErr && <span className="err">{rangeErr}</span>}
        </div>
      )}

      <Async state={data}>
        {({ rows, sessions, sessionTotal }) => {
          const sum = (f) => rows.reduce((a, r) => a + r[f], 0);
          const sitting = sum('sittingSeconds');
          const chart = rows.map((r) => ({
            label: shortDay(r.date),
            good: mins(r.goodPostureSeconds),
            slouch: mins(r.slouchingSeconds),
            score: postureScore(r),
            warnings: r.postureWarnings,
            breaks: r.breaksTaken
          }));
          const avg = averageScore(rows);
          const empty = sitting === 0;
          return (
            <>
              <dl className="stats wide">
                <div><dt>Sitting time</dt><dd className="num">{dur(sitting)}</dd></div>
                <div><dt>Good posture</dt><dd className="num">{pct(sum('goodPostureSeconds'), sitting)}%</dd></div>
                <div><dt>Posture warnings</dt><dd className="num">{sum('postureWarnings')}</dd></div>
                <div><dt>Breaks taken</dt><dd className="num">{sum('breaksTaken')}</dd></div>
                <div><dt>Average score</dt><dd className="num">{avg === null ? '--' : avg}</dd></div>
              </dl>
              {empty && <p className="empty">No sitting was recorded in this period. Pick a different range or sit down on the chair.</p>}

              <Chart title="Sitting time per day">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--hair)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
                  <YAxis tickLine={false} axisLine={false} tick={tick} width={44} unit=" m" allowDecimals={false} />
                  <Tooltip content={<Tip unit="min" />} cursor={{ fill: 'var(--wash)' }} />
                  <Legend iconType="circle" wrapperStyle={{ color: 'var(--muted)', fontSize: 13 }} />
                  <Bar dataKey="good" name="Good posture" stackId="a" fill="var(--good)" />
                  <Bar dataKey="slouch" name="Slouching" stackId="a" fill="var(--bad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </Chart>

              <Chart title="Daily posture score">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--hair)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={tick} width={44} />
                  <Tooltip content={<Tip />} />
                  <Line type="monotone" dataKey="score" name="Score" stroke="var(--info)" strokeWidth={2.5}
                        dot={{ r: 3, fill: 'var(--info)', stroke: 'none' }} connectNulls={false} />
                </LineChart>
              </Chart>

              <Chart title="Warnings and breaks" height={220}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--hair)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
                  <YAxis tickLine={false} axisLine={false} tick={tick} width={44} unit="" allowDecimals={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: 'var(--wash)' }} />
                  <Legend iconType="circle" wrapperStyle={{ color: 'var(--muted)', fontSize: 13 }} />
                  <Bar dataKey="warnings" name="Posture warnings" fill="var(--warn)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="breaks" name="Breaks taken" fill="var(--info)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </Chart>

              <section className="block">
                <h2>Sessions in this period</h2>
                {sessions.length === 0 ? <p className="empty">No sessions in this period.</p> : (
                  <ul className="plain">
                    {sessions.slice(0, 8).map((s) => (
                      <li key={s._id}>
                        <Link to={`/sessions/${s._id}`}>{dateTimeOf(s.startTime)}</Link>
                        <span className="num">{s.endTime ? dur(s.durationSeconds) : 'In progress'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sessionTotal > 0 && <p className="muted small">{sessionTotal} session{sessionTotal === 1 ? '' : 's'} in total. <Link to="/sessions">See all sessions</Link></p>}
              </section>
            </>
          );
        }}
      </Async>
    </>
  );
}
