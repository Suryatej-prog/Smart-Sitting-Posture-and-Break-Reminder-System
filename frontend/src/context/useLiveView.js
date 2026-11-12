import { useMemo } from 'react';
import { useLive } from './LiveContext';
import { useNow } from '../hooks/useNow';
import { STALE_MS } from '../config';

/*
  Turns the latest backend state into what the screen should show.
  The key rule: if no sensor message arrived within STALE_MS, the device is
  "offline" and no sensor value is presented as live.

  mode: offline | idle (not seated) | good | slouch | unknown (seated, unclassified)
*/
export function deriveView(live, now) {
  const dev = live.active;
  const s = dev ? dev.state : null;
  const threshold = (s && s.breakThresholdSeconds) || (live.settings && live.settings.breakThresholdSeconds) || null;
  const base = {
    state: s, threshold, conn: 'never', mode: 'offline', ageMs: null, rxAt: dev ? dev.rxAt : null,
    sitSeconds: 0, remaining: threshold, overdue: false, slouchFor: null, corrected: false
  };
  if (!s || !dev.rxAt) return base;

  const ageMs = Math.max(0, now - dev.rxAt);
  if (ageMs > STALE_MS) return { ...base, conn: 'offline', ageMs };

  let mode = 'unknown';
  if (!s.isSeated) mode = 'idle';
  else if (s.postureStatus === 'slouching') mode = 'slouch';
  else if (s.postureStatus === 'sitting_straight') mode = 'good';

  // Between two messages, keep the counter moving from the last reported value.
  const sitSeconds = s.isSeated ? s.sittingDurationSeconds + ageMs / 1000 : 0;
  const remaining = threshold == null ? null : Math.max(0, threshold - sitSeconds);
  const overdue = s.isSeated && (s.breakRequired || (threshold != null && sitSeconds >= threshold));
  return {
    ...base, conn: 'online', mode, ageMs, sitSeconds, remaining, overdue,
    slouchFor: mode === 'slouch' && live.slouchSince ? (now - live.slouchSince) / 1000 : null,
    corrected: mode === 'good' && Boolean(live.correctedAt) && now - live.correctedAt < 3500
  };
}

export function useLiveView() {
  const live = useLive();
  const now = useNow(1000);
  const view = useMemo(() => deriveView(live, now), [live, now]);
  return { view, live, now };
}
