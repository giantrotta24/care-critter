import type { SleepWindow } from './types';

const MINUTES_PER_DAY = 24 * 60;

export function toIsoDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseClockToMinutes(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function isWithinSleepWindow(ts: number, window: SleepWindow): boolean {
  const d = new Date(ts);
  const nowMinutes = d.getHours() * 60 + d.getMinutes();
  const start = parseClockToMinutes(window.start);
  const end = parseClockToMinutes(window.end);

  if (start === end) {
    return true;
  }

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }

  return nowMinutes >= start || nowMinutes < end;
}

export function canSleepNow(
  ts: number,
  window: SleepWindow,
  parentOverrideSleep: boolean
): boolean {
  if (parentOverrideSleep) {
    return true;
  }
  return isWithinSleepWindow(ts, window);
}

export function calculateAgeDays(createdTs: number, nowTs: number): number {
  const start = new Date(createdTs);
  const end = new Date(nowTs);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  return Math.floor(diffMinutes / MINUTES_PER_DAY);
}
