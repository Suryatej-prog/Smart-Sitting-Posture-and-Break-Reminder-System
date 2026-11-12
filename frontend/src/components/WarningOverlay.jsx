import { useLiveView } from '../context/useLiveView';
import { clock } from '../utils/format';

export default function WarningOverlay() {
  const { view, live } = useLiveView();
  const enabled = live.settings && live.settings.fullscreenWarning;
  if (view.mode !== 'slouch' || !enabled || live.dismissedWarn) return null;

  const s = view.state;
  let led = null;
  if (s.reportedLedOn === true) led = 'The chair LED is lit (reported by the device).';
  else if (s.reportedLedOn === false) led = 'The device reports its LED as off.';
  else if (s.expectedLedOn) led = 'The chair LED should be lit (the device does not report its LED state).';

  return (
    <div className="overlay" role="alertdialog" aria-live="assertive" aria-label="Posture warning">
      <svg className="warn-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 8L58 54H6z" />
        <path d="M32 26v14M32 46v1" />
      </svg>
      <h2>Straighten your back!</h2>
      <p>Sit straight to improve your posture.</p>
      {view.slouchFor != null && <p className="small">Slouching for {clock(view.slouchFor)}</p>}
      {led && <p className="small">{led}</p>}
      <button className="btn light" onClick={live.dismissWarn}>Dismiss</button>
    </div>
  );
}
