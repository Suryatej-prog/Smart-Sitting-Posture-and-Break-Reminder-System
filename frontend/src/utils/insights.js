import { dur, pct } from './format';

// Every sentence is derived from stored numbers. Nothing here is random or invented.
export function buildInsights({ daily, lastSession }) {
  const out = [];
  if (lastSession && lastSession.durationSeconds > 0) {
    const good = lastSession.durationSeconds - lastSession.slouchingSeconds;
    out.push(`You kept good posture for ${pct(good, lastSession.durationSeconds)}% of your last session (${dur(lastSession.durationSeconds)}).`);
  }
  if (daily && daily.sessions > 0) {
    out.push(`Your longest continuous sitting session today was ${dur(daily.longestSessionSeconds)}.`);
    out.push(
      daily.postureWarnings === 0
        ? 'No posture warnings today.'
        : `You had ${daily.postureWarnings} posture warning${daily.postureWarnings === 1 ? '' : 's'} today.`
    );
    if (daily.breakReminders > daily.breaksTaken) {
      out.push(`${daily.breakReminders} break reminders went off today and ${daily.breaksTaken} ${daily.breaksTaken === 1 ? 'was' : 'were'} taken. Consider taking more regular breaks.`);
    } else if (daily.breaksTaken > 0) {
      out.push(`You took ${daily.breaksTaken} break${daily.breaksTaken === 1 ? '' : 's'} today.`);
    }
  }
  return out;
}
