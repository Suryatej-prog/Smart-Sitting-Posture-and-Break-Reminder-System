import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api/client';
import { API_URL, FIXED_DEVICE_ID } from '../config';
import { unlockAudio, playWarning, playBreak } from '../audio/alerts';

const LiveCtx = createContext(null);
export const useLive = () => useContext(LiveCtx);

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

// Browser-only preference: minimum seconds between two dashboard warning sounds.
export const getWarnCooldown = () => Number(safeGet('upright.warnCooldown')) || 10;
export const setWarnCooldown = (s) => safeSet('upright.warnCooldown', String(s));

export function LiveProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [socketUp, setSocketUp] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(null);
  const [devices, setDevices] = useState({}); // id -> { state, rxAt }
  const [activeId, setActiveIdState] = useState(FIXED_DEVICE_ID || safeGet('upright.device') || '');
  const [trail, setTrail] = useState([]); // live readings seen by this page: { ts, posture, d }
  const [pendingBreak, setPendingBreak] = useState(null);
  const [breakModal, setBreakModal] = useState(false);
  const [ackedSession, setAckedSession] = useState(null);
  const [slouchSince, setSlouchSince] = useState(null);
  const [correctedAt, setCorrectedAt] = useState(null);
  const [dismissedWarn, setDismissedWarn] = useState(false);
  const [lastAlert, setLastAlert] = useState(null); // { kind, at }
  const [breakMarks, setBreakMarks] = useState([]); // ms timestamps of break reminders seen live
  const [sessionTick, setSessionTick] = useState(0);
  const [calTick, setCalTick] = useState(0);
  const [audioReady, setAudioReady] = useState(false);

  const R = useRef({});
  const prevPosture = useRef({});
  const lastWarnSound = useRef(0);

  const active = devices[activeId] || null;
  R.current.settings = settings;
  R.current.activeId = activeId;
  R.current.pending = pendingBreak;
  R.current.sessionId = active?.state?.sessionId || null;

  const setActive = useCallback((id) => {
    R.current.activeId = id;
    setActiveIdState(id);
    safeSet('upright.device', id);
    setTrail([]);
    setPendingBreak(null);
    setBreakModal(false);
    setSlouchSince(null);
    setCorrectedAt(null);
    setBreakMarks([]);
    setSessionTick((t) => t + 1);
  }, []);

  // One live-status message (from Socket.IO or the initial REST call).
  const ingest = useCallback((s, rxOverride) => {
    if (!s || !s.deviceId) return;
    const rxAt = rxOverride !== undefined ? rxOverride : Date.now();
    setDevices((d) => ({ ...d, [s.deviceId]: { state: s, rxAt } }));
    if (FIXED_DEVICE_ID && s.deviceId !== FIXED_DEVICE_ID) return;
    if (!R.current.activeId) {
      R.current.activeId = s.deviceId;
      setActiveIdState(s.deviceId);
    }
    if (s.deviceId !== R.current.activeId) return;

    const posture = s.isSeated ? s.postureStatus : 'not_seated';
    const prev = prevPosture.current[s.deviceId];
    prevPosture.current[s.deviceId] = posture;

    if (posture === 'slouching') {
      if (prev !== undefined && prev !== 'slouching') {
        setSlouchSince(rxAt);
        setDismissedWarn(false);
      }
    } else {
      setSlouchSince(null);
      if (prev === 'slouching' && posture === 'sitting_straight') setCorrectedAt(rxAt);
    }
    if (!s.isSeated) {
      setPendingBreak(null);
      setBreakModal(false);
    }
    if (s.lastMessageAt) {
      const ts = Date.parse(s.lastMessageAt);
      setTrail((t) => {
        if (t.length && t[t.length - 1].ts >= ts) return t;
        const next = [...t, { ts, posture, d: s.distanceCm }];
        return next.length > 1500 ? next.slice(-1500) : next;
      });
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [st, live] = await Promise.all([api.settings(), api.liveStatus()]);
      setSettings(st);
      const list = live.devices || [];
      let id = R.current.activeId;
      if (!FIXED_DEVICE_ID && !list.some((d) => d.deviceId === id)) {
        id = (list.find((d) => d.isSeated) || list[0])?.deviceId || '';
        R.current.activeId = id;
        setActiveIdState(id);
      }
      list.forEach((d) => ingest(d, d.updatedAt ? Date.parse(d.updatedAt) : null));
      setBootError(null);

      // If a break reminder fired before this page opened, show it as pending.
      const act = list.find((d) => d.deviceId === id);
      if (act && act.isSeated && act.breakRequired && act.sessionId) {
        try {
          const be = await api.breakEvents({ device_id: id, limit: 5 });
          const ev = be.items.find((e) => String(e.sessionId) === act.sessionId && e.status === 'triggered');
          if (ev) setPendingBreak({ id: String(ev._id), seconds: ev.sittingDurationSeconds });
        } catch { /* optional */ }
      }
    } catch (e) {
      setBootError(e);
    } finally {
      setBooted(true);
    }
  }, [ingest]);

  useEffect(() => {
    loadAll();
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => { setSocketUp(true); setEverConnected(true); loadAll(); });
    socket.on('disconnect', () => setSocketUp(false));
    socket.on('connect_error', () => setSocketUp(false));
    socket.on('live-status', (s) => ingest(s));
    socket.on('calibration-updated', () => setCalTick((t) => t + 1));

    socket.on('session-started', (p) => {
      if (p.deviceId === R.current.activeId) setSessionTick((t) => t + 1);
    });
    socket.on('session-ended', (p) => {
      if (p.deviceId !== R.current.activeId) return;
      setSessionTick((t) => t + 1);
      setPendingBreak(null);
      setBreakModal(false);
    });
    socket.on('posture-warning', (p) => {
      if (p.deviceId !== R.current.activeId) return;
      setLastAlert({ kind: 'posture', at: Date.now() });
      const st = R.current.settings;
      if (!st || !st.soundEnabled) return;
      // One sound per warning event, and never faster than the cooldown.
      if (Date.now() - lastWarnSound.current >= getWarnCooldown() * 1000 && playWarning(st.volume)) {
        lastWarnSound.current = Date.now();
      }
    });
    socket.on('break-reminder', (p) => {
      if (p.deviceId !== R.current.activeId) return;
      setPendingBreak({ id: p.breakEventId, seconds: p.sittingDurationSeconds });
      setBreakModal(true);
      setBreakMarks((m) => [...m, Date.now()]);
      setLastAlert({ kind: 'break', at: Date.now() });
      const st = R.current.settings;
      if (st && st.soundEnabled) playBreak(st.volume);
    });
    return () => socket.close();
  }, [ingest, loadAll]);

  const enableAudio = useCallback(async () => {
    const ok = await unlockAudio();
    setAudioReady(ok);
    return ok;
  }, []);

  // The first click or key press anywhere unlocks browser audio.
  useEffect(() => {
    const h = () => { enableAudio(); };
    window.addEventListener('pointerdown', h, { once: true });
    window.addEventListener('keydown', h, { once: true });
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, [enableAudio]);

  const updateSettings = useCallback(async (patch) => {
    const saved = await api.saveSettings(patch);
    setSettings(saved);
    return saved;
  }, []);

  const acknowledgeBreak = useCallback(async () => {
    const pb = R.current.pending;
    if (!pb) return;
    await api.ackBreak(pb.id);
    setAckedSession(R.current.sessionId);
    setPendingBreak(null);
    setBreakModal(false);
  }, []);

  const testSound = useCallback(async (kind) => {
    const ok = await enableAudio();
    if (!ok) return false;
    const v = R.current.settings ? R.current.settings.volume : 0.8;
    return kind === 'break' ? playBreak(v) : playWarning(v);
  }, [enableAudio]);

  const value = {
    settings, updateSettings,
    socketUp, booted, bootError, reload: loadAll,
    serverDown: booted && !socketUp && (Boolean(bootError) || everConnected),
    devices, activeId, active, setActive,
    trail, pendingBreak, breakModal, setBreakModal, acknowledgeBreak, ackedSession,
    slouchSince, correctedAt, dismissedWarn,
    dismissWarn: () => setDismissedWarn(true),
    lastAlert, breakMarks, sessionTick, calTick,
    audioReady, enableAudio, testSound
  };
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
