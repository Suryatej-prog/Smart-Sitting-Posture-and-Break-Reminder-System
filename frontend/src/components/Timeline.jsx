import { useMemo } from 'react';
import { buildSegments } from '../utils/timeline';
import { STATUS_LABEL, timeOf, dur } from '../utils/format';

const CLS = { sitting_straight: 'good', slouching: 'bad', unknown: 'unk', not_seated: 'off', nodata: 'gap' };

export default function Timeline({ points, endMs, startMs, breakTimes = [], note }) {
  const segs = useMemo(() => buildSegments(points, endMs), [points, endMs]);
  if (!segs.length) return <p className="empty">No readings recorded for this period.</p>;

  const from = startMs != null ? Math.min(startMs, segs[0].from) : segs[0].from;
  const to = Math.max(endMs, segs[segs.length - 1].to);
  const span = Math.max(1, to - from);
  const x = (t) => `${((t - from) / span) * 100}%`;
  const marks = breakTimes.filter((t) => t >= from && t <= to);

  const events = [
    ...segs.filter((s) => s.status !== 'nodata').map((s) => ({ ts: s.from, label: STATUS_LABEL[s.status], cls: CLS[s.status] })),
    ...marks.map((t) => ({ ts: t, label: 'Break reminder', cls: 'info' }))
  ].sort((a, b) => a.ts - b.ts).slice(-8);

  return (
    <div className="timeline">
      <div className="tl-bar" role="img" aria-label="Posture timeline">
        {segs.map((s, i) => (
          <i
            key={i}
            className={`seg ${CLS[s.status]}`}
            style={{ left: x(s.from), width: `${((s.to - s.from) / span) * 100}%` }}
            title={`${STATUS_LABEL[s.status]}, ${timeOf(s.from)} for ${dur((s.to - s.from) / 1000)}`}
          />
        ))}
        {marks.map((t, i) => (
          <b key={i} className="tl-break" style={{ left: x(t) }} title={`Break reminder, ${timeOf(t)}`} />
        ))}
      </div>
      <div className="tl-axis">
        <span>{timeOf(from, false)}</span>
        <span>{timeOf(to, false)}</span>
      </div>
      <ul className="legend">
        <li><i className="dot good" />Sitting straight</li>
        <li><i className="dot bad" />Slouching</li>
        <li><i className="dot info" />Break reminder</li>
        <li><i className="dot off" />Not seated or no data</li>
      </ul>
      <ol className="events">
        {events.map((e, i) => (
          <li key={i}><i className={`dot ${e.cls}`} /><span className="num">{timeOf(e.ts)}</span> {e.label}</li>
        ))}
      </ol>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}
