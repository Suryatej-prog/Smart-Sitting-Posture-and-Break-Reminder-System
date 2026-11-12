import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { getWarnCooldown, setWarnCooldown, useLive } from '../context/LiveContext';
import { useAsync } from '../hooks/useAsync';
import Async from '../components/Async';
import { dateTimeOf, dur } from '../utils/format';

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
            className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button>
  );
}

function Field({ title, help, children }) {
  return (
    <div className="field">
      <div><b>{title}</b>{help && <p className="muted small">{help}</p>}</div>
      <div className="ctl">{children}</div>
    </div>
  );
}

export default function Settings() {
  const live = useLive();
  const [form, setForm] = useState(null);
  const [cooldown, setCooldown] = useState(getWarnCooldown());
  const [status, setStatus] = useState(null); // { ok, text }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (live.settings) {
      const { breakThresholdSeconds, soundEnabled, volume, fullscreenWarning, theme } = live.settings;
      setForm({ breakThresholdSeconds, soundEnabled, volume, fullscreenWarning, theme });
    }
  }, [live.settings]);

  const cal = useAsync(async () => {
    try { return await api.latestCalibration(live.activeId || undefined); }
    catch (e) { if (e.status === 404) return { none: true }; throw e; }
  }, [live.activeId, live.calTick]);

  if (!live.settings || !form) {
    return (
      <>
        <div className="head"><h1>Settings</h1></div>
        {live.booted ? <p className="err">Settings couldn't be loaded. {live.bootError ? live.bootError.message : ''} <button className="linkbtn" onClick={live.reload}>Try again</button></p> : <p className="muted">Loading...</p>}
      </>
    );
  }

  const set = (k, v) => { setStatus(null); setForm((f) => ({ ...f, [k]: v })); };
  const threshold = Number(form.breakThresholdSeconds);
  const thresholdOk = Number.isFinite(threshold) && threshold >= 5 && threshold <= 86400;
  const cd = Number(cooldown);
  const cdOk = Number.isFinite(cd) && cd >= 1 && cd <= 600;
  const changed = Object.keys(form).some((k) => form[k] !== live.settings[k]) || cd !== getWarnCooldown();

  async function save() {
    if (!thresholdOk) return setStatus({ ok: false, text: 'Break time must be between 5 and 86400 seconds.' });
    if (!cdOk) return setStatus({ ok: false, text: 'Warning sound gap must be between 1 and 600 seconds.' });
    setSaving(true);
    try {
      await live.updateSettings({ ...form, breakThresholdSeconds: Math.round(threshold) });
      setWarnCooldown(Math.round(cd));
      setStatus({ ok: true, text: 'Settings saved.' });
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="head"><h1>Settings</h1></div>

      <section className="block">
        <h2>Break reminder</h2>
        <Field title="Remind me after" help={`Currently ${thresholdOk ? dur(threshold) : 'invalid'} of continuous sitting. Use 60 seconds for demos.`}>
          <input type="number" min="5" max="86400" value={form.breakThresholdSeconds}
                 onChange={(e) => set('breakThresholdSeconds', e.target.value)} aria-label="Break threshold in seconds" />
          <span className="muted">seconds</span>
        </Field>
      </section>

      <section className="block">
        <h2>Alerts</h2>
        <Field title="Sound alerts" help="Plays in this browser when slouching starts or a break is due.">
          <Switch checked={form.soundEnabled} onChange={(v) => set('soundEnabled', v)} label="Sound alerts" />
        </Field>
        <Field title="Volume">
          <input type="range" min="0" max="1" step="0.05" value={form.volume}
                 onChange={(e) => set('volume', Number(e.target.value))} aria-label="Alert volume" />
          <span className="num muted">{Math.round(form.volume * 100)}%</span>
        </Field>
        <Field title="Sound check" help={live.audioReady ? 'Uses the volume saved above.' : 'Click once to let the browser play sound.'}>
          <button className="btn" onClick={() => live.testSound('warning')}>Posture sound</button>
          <button className="btn" onClick={() => live.testSound('break')}>Break sound</button>
        </Field>
        <Field title="Gap between warning sounds" help="Stops the posture sound repeating if you keep slouching. Saved in this browser only.">
          <input type="number" min="1" max="600" value={cooldown} onChange={(e) => { setStatus(null); setCooldown(e.target.value); }} aria-label="Seconds between warning sounds" />
          <span className="muted">seconds</span>
        </Field>
        <Field title="Full-screen warning" help="Covers the screen in red while you slouch. The page frame still pulses when this is off.">
          <Switch checked={form.fullscreenWarning} onChange={(v) => set('fullscreenWarning', v)} label="Full-screen warning" />
        </Field>
      </section>

      <section className="block">
        <h2>Appearance</h2>
        <Field title="Theme">
          <div className="seg-ctl" role="group" aria-label="Theme">
            {['dark', 'light'].map((t) => (
              <button key={t} className={form.theme === t ? 'on' : ''} onClick={() => set('theme', t)}>{t === 'dark' ? 'Dark' : 'Light'}</button>
            ))}
          </div>
        </Field>
      </section>

      <div className="savebar">
        <button className="btn primary" onClick={save} disabled={saving || !changed}>{saving ? 'Saving...' : 'Save changes'}</button>
        {status && <span className={status.ok ? 'good' : 'err'}>{status.text}</span>}
      </div>

      <section className="block">
        <h2>Calibration</h2>
        <Async state={cal}>
          {(c) => c.none ? (
            <p className="empty">No calibration recorded yet. Sit straight and press the button on the chair.</p>
          ) : (
            <dl className="rows">
              <Row2 label="Straight-posture distance">{c.calibratedDistanceCm != null ? `${Number(c.calibratedDistanceCm).toFixed(1)} cm` : 'Not reported'}</Row2>
              <Row2 label="Calibrated">{dateTimeOf(c.calibratedAt)}</Row2>
              <Row2 label="Device">{c.deviceId}</Row2>
            </dl>
          )}
        </Async>
        <p className="muted small">Calibration is started with the push button on the chair. The backend can record it but can't trigger it, so there is no button for it here.</p>
      </section>
    </>
  );
}

function Row2({ label, children }) {
  return <div className="row"><dt>{label}</dt><dd>{children}</dd></div>;
}
