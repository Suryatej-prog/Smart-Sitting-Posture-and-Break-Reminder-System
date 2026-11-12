import { useState } from 'react';
import { useLive } from '../context/LiveContext';
import { dur } from '../utils/format';

export default function BreakModal() {
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!live.breakModal || !live.pendingBreak) return null;

  async function ack() {
    setBusy(true);
    setErr(null);
    try { await live.acknowledgeBreak(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Break reminder">
      <div className="dialog">
        <h2>Time to take a break!</h2>
        <p>You've been sitting for {dur(live.pendingBreak.seconds)}. Stand up, stretch and walk around for a minute.</p>
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn primary" onClick={ack} disabled={busy}>I've taken a break</button>
          <button className="btn" onClick={() => live.setBreakModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
