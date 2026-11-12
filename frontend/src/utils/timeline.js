// Turn ordered readings [{ts, posture}] into coloured segments [{status, from, to}].
// A silence longer than the normal reporting gap becomes a "No data" segment
// instead of being painted as if the user was still sitting.
export function buildSegments(points, endMs) {
  if (!points.length) return [];
  const deltas = [];
  for (let i = 1; i < points.length; i++) deltas.push(points[i].ts - points[i - 1].ts);
  const median = deltas.length ? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : 1000;
  const step = Math.max(median, 1000);
  const maxGap = Math.max(15000, step * 5);
  const segs = [];

  const push = (status, from, to) => {
    if (to <= from) return;
    const last = segs[segs.length - 1];
    if (last && last.status === status && Math.abs(last.to - from) < 1) last.to = to;
    else segs.push({ status, from, to });
  };

  points.forEach((p, i) => {
    const stop = i + 1 < points.length ? points[i + 1].ts : endMs;
    if (stop - p.ts > maxGap) {
      push(p.posture, p.ts, p.ts + step);
      push('nodata', p.ts + step, stop);
    } else {
      push(p.posture, p.ts, stop);
    }
  });
  return segs;
}

export const readingToPoint = (r) => ({
  ts: new Date(r.timestamp).getTime(),
  posture: r.isSeated ? r.postureStatus : 'not_seated'
});
