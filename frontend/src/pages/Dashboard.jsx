import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveView } from '../context/useLiveView';
import { useOverview } from '../hooks/useOverview';
import Async from '../components/Async';
import PostureHero from '../components/PostureHero';
import LiveTimeline from '../components/LiveTimeline';
import ScoreRing from '../components/ScoreRing';
import Sparkline from '../components/Sparkline';
import { ago, clock, dur, pct, timeOf } from '../utils/format';
import { averageScore, postureScore, scoreWord } from '../utils/score';
import { buildInsights } from '../utils/insights';
import { buildAchievements } from '../utils/achievements';

function Row({ label, children, hint }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{children}{hint && <span className="muted small"> {hint}</span>}</dd>
    </div>
  );
}

function hw(value, online, expected) {
  if (!online) return { text: '--' };
  if (value === true) return { text: 'On', tone: 'bad' };
  if (value === false) return { text: 'Off' };
  return { text: 'Not reported', hint: `Rules expect it ${expected ? 'on' : 'off'}.` };
}

function AckButton({ live }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function go() {
    setBusy(true); setErr(null);
    try { await live.acknowledgeBreak(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <button className="btn primary" onClick={go} disabled={busy}>I've taken a break</button>
      {err && <p className="err">{err}</p>}
    </>
  );
}

export default function Dashboard() {
  const { view, live, now } = useLiveView();
  const ov = useOverview(live.activeId, live.sessionTick + Math.floor(now / 30000));
  const s = view.state;
  const online = view.conn === 'online';
  const seated = online && s.isSeated;
  const score = ov.data ? postureScore(ov.data.daily) : null;

  const nextBreak = !seated ? '--' : view.overdue ? 'Now' : clock(view.remaining);
  const progress = seated && view.threshold ? Math.min(100, (view.sitSeconds / view.threshold) * 100) : 0;
  const spark = live.trail.filter((p) => p.d != null).slice(-60).map((p) => p.d);

  const led = hw(s && s.reportedLedOn, online, s && s.expectedLedOn);
  const buzzer = hw(s && s.reportedBuzzerOn, online, s && s.expectedBuzzerOn);
  const lastBreak = ov.data && ov.data.breaks[0];
  const lastAlertText = live.lastAlert
    ? `${live.lastAlert.kind === 'posture' ? 'Posture warning' : 'Break reminder'} at ${timeOf(live.lastAlert.at)}`
    : lastBreak ? `Break reminder at ${timeOf(lastBreak.timestamp)}` : 'None yet';

  return (
    <div className="stage" data-mode={view.mode}>
      <div className="wash" aria-hidden="true"><i className="w-good" /><i className="w-bad" /></div>
      <PostureHero view={view} booted={live.booted} />

      <div className="readouts">
        <div>
          <span className="k">Distance</span>
          <span className="v num">{online && s.distanceCm != null ? `${s.distanceCm.toFixed(1)} cm` : '--'}</span>
        </div>
        <div>
          <span className="k">Next break in</span>
          <span className="v num">{nextBreak}</span>
        </div>
        <div>
          <span className="k">Today's score</span>
          <span className="v num">{score === null ? '--' : score}</span>
        </div>
        <div>
          <span className="k">Last update</span>
          <span className="v num">{view.rxAt ? timeOf(view.rxAt) : '--'}</span>
          <span className="muted small">{view.ageMs != null ? ago(view.ageMs) : 'no data yet'}</span>
        </div>
      </div>

      <section className="block">
        <h2>Break reminder</h2>
        {!seated ? (
          <p className="lede">
            The count starts when someone sits down.
            {view.threshold ? ` A reminder fires after ${dur(view.threshold)} of continuous sitting.` : ''}
          </p>
        ) : (
          <>
            <p className={`big ${view.overdue ? 'warn' : ''}`}>
              {view.overdue ? 'Time to take a break!' : `Break in ${clock(view.remaining)}`}
            </p>
            <div className={`bar ${view.overdue ? 'warn' : ''}`} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
              <i style={{ width: `${progress}%` }} />
            </div>
            <p className="muted small">Sitting {clock(view.sitSeconds)} of {dur(view.threshold)} allowed.</p>
            {live.pendingBreak && <AckButton live={live} />}
            {view.overdue && !live.pendingBreak && live.ackedSession === s.sessionId && (
              <p className="lede">Reminder acknowledged. Stand up to start a fresh count.</p>
            )}
          </>
        )}
      </section>

      <section className="block">
        <h2>This session</h2>
        <LiveTimeline live={live} state={s} />
      </section>

      <section className="block">
        <h2>Today</h2>
        <Async state={ov}>
          {(d) => {
            const t = d.daily;
            const week = averageScore(d.weekly.days);
            const stats = [
              ['Sitting time', dur(t.sittingSeconds)],
              ['Good posture', `${dur(t.goodPostureSeconds)} (${pct(t.goodPostureSeconds, t.sittingSeconds)}%)`],
              ['Slouching', dur(t.slouchingSeconds)],
              ['Posture warnings', t.postureWarnings],
              ['Breaks taken', t.breaksTaken],
              ['Longest sitting', dur(t.longestSessionSeconds)]
            ];
            return (
              <>
                <div className="score">
                  <ScoreRing value={score} />
                  <div>
                    <p className="big">{scoreWord(score)}</p>
                    <p className="muted">
                      Today's posture score. Seven-day average: {week === null ? 'no data yet' : `${week} out of 100`}.
                    </p>
                    <details className="how">
                      <summary>How the score works</summary>
                      <p>
                        70% is the share of sitting time with good posture, 20% is breaks taken out of reminders sent,
                        and 10% reflects how often you slouched per 10 minutes. It is calculated only from stored sessions.
                      </p>
                    </details>
                  </div>
                </div>
                {t.sessions === 0 && <p className="empty">Nothing recorded today yet. Sit down and the numbers start counting.</p>}
                <dl className="stats">
                  {stats.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>
                  ))}
                </dl>
              </>
            );
          }}
        </Async>
      </section>

      <section className="block">
        <h2>Insights</h2>
        <Async state={ov}>
          {(d) => {
            const items = buildInsights({ daily: d.daily, lastSession: d.sessions.find((x) => x.endTime) });
            return items.length
              ? <ul className="insights">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
              : <p className="empty">Insights appear once there is sitting data to learn from.</p>;
          }}
        </Async>
      </section>

      <section className="block">
        <h2>Achievements</h2>
        <Async state={ov}>
          {(d) => (
            <ul className="badges">
              {buildAchievements(d.sessions, d.breaks).map((a) => (
                <li key={a.id} className={a.unlocked ? 'on' : ''}>
                  <b>{a.name}</b>
                  <span>{a.unlocked ? 'Unlocked' : a.progress}</span>
                  <small>{a.text}</small>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </section>

      <section className="block cols">
        <div>
          <h2>Sensors</h2>
          <dl className="rows">
            <Row label="Seat sensor (FSR)">{online ? (s.isSeated ? 'Someone is sitting' : 'Chair empty') : '--'}</Row>
            <Row label="Distance sensor">{online ? (s.distanceCm != null ? `${s.distanceCm.toFixed(1)} cm` : 'No echo') : '--'}</Row>
            <Row label="ESP32">{online ? 'Connected' : view.conn === 'offline' ? 'Disconnected' : 'Never seen'}</Row>
            <Row label="MQTT broker">{s ? (s.mqttConnected ? 'Connected' : 'Disconnected') : '--'}</Row>
          </dl>
          {online && <Sparkline values={spark} />}
          <p className="muted small">The backend reports seat detection as occupied or empty, not as a raw pressure value.</p>
        </div>
        <div>
          <h2>Chair alerts</h2>
          <dl className="rows">
            <Row label="LED" hint={led.hint}><span className={led.tone || ''}>{led.text}</span></Row>
            <Row label="Buzzer" hint={buzzer.hint}><span className={buzzer.tone || ''}>{buzzer.text}</span></Row>
            <Row label="Last alert">{lastAlertText}</Row>
          </dl>
          <p className="muted small">LED and buzzer states show only what the ESP32 itself reports. <Link to="/device">Device details</Link></p>
        </div>
      </section>
    </div>
  );
}
