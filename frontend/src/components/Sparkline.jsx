// Tiny line chart of recent distance readings (real values only).
export default function Sparkline({ values }) {
  if (values.length < 2) return <p className="muted small">Waiting for more readings.</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 300},${54 - ((v - min) / range) * 48}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="Recent distance readings">
      <polyline points={pts} />
    </svg>
  );
}
