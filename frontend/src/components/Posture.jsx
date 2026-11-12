// Side view of a seated person. The torso leans forward when slouching.
const LABEL = {
  good: 'Sitting straight',
  slouch: 'Slouching forward',
  idle: 'Chair empty',
  unknown: 'Seated',
  offline: 'No signal'
};

export default function Posture({ mode }) {
  const lean = mode === 'slouch' ? 26 : 0;
  const dim = mode === 'offline' || mode === 'idle';
  return (
    <svg className={`posture ${mode}`} viewBox="0 0 220 280" role="img" aria-label={LABEL[mode]}>
      <path className="chair" d="M58 96V196H128M58 196V262" />
      <g className="person" style={{ opacity: dim ? 0.16 : 1 }}>
        <path d="M96 196H158V262" />
        <g className="torso" style={{ transform: `rotate(${lean}deg)`, transformOrigin: '96px 196px' }}>
          <path d="M96 196V104" />
          <circle cx="96" cy="80" r="17" />
        </g>
      </g>
    </svg>
  );
}
