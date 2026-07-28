import { CronExpressionParser } from 'cron-parser';

function sameUtcMinute(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate() &&
    a.getUTCHours() === b.getUTCHours() &&
    a.getUTCMinutes() === b.getUTCMinutes()
  );
}

export function isCronDue(
  cronExpression: string,
  now: Date,
  timezone = 'UTC',
): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: now,
      tz: timezone,
    });
    const prev = interval.prev().toDate();
    return sameUtcMinute(prev, now);
  } catch {
    return false;
  }
}
