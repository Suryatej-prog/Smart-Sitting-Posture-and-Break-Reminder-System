/*
  Posture score (0-100), computed only from stored sitting data.

    score = 100 x ( 0.70 x goodPostureShare
                  + 0.20 x breakShare
                  + 0.10 x warningShare )

  goodPostureShare = good posture time / sitting time
  breakShare       = breaks taken / break reminders sent   (1 if no reminder was needed)
  warningShare     = 1 - (warnings per 10 minutes sitting / 3), limited to 0..1
                     (3 or more warnings every 10 minutes scores zero here)

  No sitting time means no score (null), never a made-up number.
  Weekly average = mean of the daily scores for days that have data.
*/
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function postureScore(d) {
  if (!d || !d.sittingSeconds) return null;
  const good = clamp(d.goodPostureSeconds / d.sittingSeconds, 0, 1);
  const breaks = d.breakReminders > 0 ? clamp(d.breaksTaken / d.breakReminders, 0, 1) : 1;
  const perTenMin = d.postureWarnings / Math.max(1, d.sittingSeconds / 600);
  const warn = 1 - clamp(perTenMin / 3, 0, 1);
  return Math.round(100 * (0.7 * good + 0.2 * breaks + 0.1 * warn));
}

export function averageScore(days) {
  const scores = days.map(postureScore).filter((s) => s !== null);
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

export function scoreWord(s) {
  if (s === null) return 'No data yet';
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Fair';
  return 'Needs work';
}
