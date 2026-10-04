import { Schedule } from './schedule.entity';

type Rule = Pick<Schedule, 'days' | 'startTime' | 'endTime'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekday (0 = Sunday) and minutes since midnight of `date` in time zone `tz`. */
export function localParts(date: Date, tz: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Is the rule in effect at `now` (evaluated in `tz`)? Handles all-day and past-midnight ranges. */
export function isActive(rule: Rule, now: Date, tz: string): boolean {
  const { day, minutes } = localParts(now, tz);
  const allDay = !rule.startTime || !rule.endTime || rule.startTime === rule.endTime;
  if (allDay) return rule.days.includes(day);

  const start = toMinutes(rule.startTime!);
  const end = toMinutes(rule.endTime!);
  if (start < end) return rule.days.includes(day) && minutes >= start && minutes < end;
  // Past midnight: the evening part belongs to today, the morning part to a schedule that started yesterday.
  const yesterday = (day + 6) % 7;
  return (rule.days.includes(day) && minutes >= start) || (rule.days.includes(yesterday) && minutes < end);
}

/**
 * The winning schedule for a device: highest priority, then a device-specific
 * schedule over a group one, then the most recently created.
 */
export function pickSchedule(
  schedules: Schedule[],
  device: { id: string; groupId?: string | null },
  now: Date,
  tz: string,
): Schedule | null {
  const matching = schedules.filter(
    (s) =>
      s.enabled &&
      ((s.targetType === 'device' && s.targetId === device.id) ||
        (s.targetType === 'group' && !!device.groupId && s.targetId === device.groupId)) &&
      isActive(s, now, tz),
  );
  matching.sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(b.targetType === 'device') - Number(a.targetType === 'device') ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return matching[0] ?? null;
}
