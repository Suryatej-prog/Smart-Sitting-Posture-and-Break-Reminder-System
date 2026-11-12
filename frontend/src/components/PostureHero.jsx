import Posture from './Posture';
import { ago, clock, dur } from '../utils/format';

function copyFor(view, booted) {
  if (view.corrected) return { title: 'Posture corrected', line: 'Nice. Keep it up.', tone: 'good' };
  switch (view.mode) {
    case 'good': return { title: 'Good posture', line: "You're sitting straight.", tone: 'good' };
    case 'slouch': return { title: 'Bad posture detected!', line: 'Sit straight to improve your posture.', tone: 'bad' };
    case 'idle': return { title: 'No user detected', line: 'The sitting timer is paused until someone sits down.', tone: 'muted' };
    case 'unknown': return { title: 'Seated', line: 'The chair has not classified your posture yet.', tone: 'info' };
    default:
      return view.conn === 'offline'
        ? { title: 'Device disconnected', line: `Waiting for sensor data. Last message ${ago(view.ageMs)}.`, tone: 'muted' }
        : { title: booted ? 'Waiting for a device' : 'Connecting', line: booted ? 'No chair has reported to the backend yet.' : 'Reaching the backend.', tone: 'muted' };
  }
}

export default function PostureHero({ view, booted }) {
  const c = copyFor(view, booted);
  const s = view.state;
  const live = view.conn === 'online';
  const timer = live ? clock(view.sitSeconds) : view.mode === 'offline' ? '--:--' : '00:00';
  const timerNote = !live ? 'sitting time unavailable' : view.mode === 'idle' ? 'sitting time, paused' : 'sitting time';

  return (
    <section className="hero">
      <div className="hero-text">
        <h1 className={`state ${c.tone}`}>
          {view.corrected && (
            <svg className="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          )}
          {c.title}
        </h1>
        <p className="lede">{c.line}</p>
        {view.mode === 'slouch' && view.slouchFor != null && (
          <p className="lede bad">Slouching for {clock(view.slouchFor)}</p>
        )}
        <p className="timer">
          <span className="num" aria-live="off">{timer}</span>
          <span className="muted">{timerNote}</span>
        </p>
        {live && s.isSeated && (
          <p className="muted small">
            This session: {dur(s.slouchingSeconds)} slouching, {s.postureWarnings} posture warning{s.postureWarnings === 1 ? '' : 's'}.
          </p>
        )}
      </div>
      <Posture mode={view.mode} />
    </section>
  );
}
