import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLiveView } from '../context/useLiveView';
import { API_URL } from '../config';
import WarningOverlay from './WarningOverlay';
import BreakModal from './BreakModal';

const links = [
  { to: '/', label: 'Live', end: true },
  { to: '/analytics', label: 'Analytics' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/device', label: 'Device' },
  { to: '/settings', label: 'Settings' }
];

export default function Shell() {
  const { view, live } = useLiveView();
  const theme = (live.settings && live.settings.theme) || 'dark';
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  let pill;
  if (live.serverDown) pill = { tone: 'bad', text: 'Server offline' };
  else if (view.conn === 'online') pill = { tone: 'good', text: 'Live' };
  else if (view.conn === 'offline') pill = { tone: 'warn', text: 'Device offline' };
  else pill = { tone: 'muted', text: live.booted ? 'No device yet' : 'Connecting' };

  const onSound = () => {
    if (!live.audioReady) return live.enableAudio();
    if (live.settings) live.updateSettings({ soundEnabled: !live.settings.soundEnabled }).catch(() => {});
  };
  const soundLabel = !live.audioReady ? 'Enable sound alerts' : live.settings && live.settings.soundEnabled ? 'Sound on' : 'Muted';

  return (
    <>
      <header className="nav">
        <span className="brand">Upright</span>
        <nav aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="nav-end">
          <button className="linkbtn" onClick={onSound}>{soundLabel}</button>
          <span className={`pill ${pill.tone}`}><i />{pill.text}</span>
        </div>
      </header>

      {live.serverDown && (
        <div className="banner">
          Can't reach the backend at {API_URL}. Live data resumes automatically when it is back.
        </div>
      )}

      <main className="page">
        <Outlet />
      </main>
      <WarningOverlay />
      <BreakModal />
    </>
  );
}
