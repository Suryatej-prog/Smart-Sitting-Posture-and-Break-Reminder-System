import { dur } from './format';

// Unlocked only when the stored data meets the condition.
export function buildAchievements(sessions = [], breakEvents = []) {
  const done = sessions.filter((s) => s.endTime);
  const goodOf = (s) => Math.max(0, s.durationSeconds - s.slouchingSeconds);
  const bestGood = done.reduce((m, s) => Math.max(m, goodOf(s)), 0);
  const takenBreaks = breakEvents.filter((b) => b.breakTaken).length;
  const champion = done.some((s) => s.durationSeconds >= 900 && goodOf(s) / s.durationSeconds >= 0.9);

  return [
    { id: 'first-break', name: 'First break taken', text: 'Stand up after a break reminder.', unlocked: takenBreaks >= 1, progress: `${Math.min(takenBreaks, 1)} of 1` },
    { id: 'ten-min', name: '10 minutes of good posture', text: 'Hold good posture for 10 minutes in one session.', unlocked: bestGood >= 600, progress: `${dur(Math.min(bestGood, 600))} of 10m` },
    { id: 'champion', name: 'Posture champion', text: 'Sit 15 minutes or more with at least 90% good posture.', unlocked: champion, progress: champion ? 'Done' : 'Not yet' },
    { id: 'break-master', name: 'Break master', text: 'Take 10 breaks.', unlocked: takenBreaks >= 10, progress: `${Math.min(takenBreaks, 10)} of 10` }
  ];
}
