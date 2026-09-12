import type { Day } from '../types';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const DAY_ABBR: Record<Day, string> = {
  Mon: 'M',
  Tue: 'Tu',
  Wed: 'W',
  Thu: 'Th',
  Fri: 'F',
  Sat: 'Sa',
  Sun: 'Su',
};

export function formatDays(days: Day[]): string {
  if (days.length === 0) return 'TBA';
  return days.map((d) => DAY_ABBR[d]).join('');
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 'TBA';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function formatTimeRange(start: string, end: string): string {
  if (!start || !end) return 'TBA';
  return `${formatTime(start)} – ${formatTime(end)}`;
}
