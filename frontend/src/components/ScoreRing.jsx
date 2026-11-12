export default function ScoreRing({ value, size = 132 }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = value === null ? 'off' : value >= 70 ? 'good' : value >= 50 ? 'warn' : 'bad';
  const filled = value === null ? 0 : (value / 100) * c;
  return (
    <svg className={`ring ${tone}`} width={size} height={size} viewBox="0 0 120 120" role="img"
         aria-label={value === null ? 'No score yet' : `Score ${value} out of 100`}>
      <circle className="ring-track" cx="60" cy="60" r={r} />
      <circle className="ring-bar" cx="60" cy="60" r={r} strokeDasharray={`${filled} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="68" textAnchor="middle" className="ring-num">{value === null ? '--' : value}</text>
    </svg>
  );
}
