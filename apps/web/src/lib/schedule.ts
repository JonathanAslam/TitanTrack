import type { Section } from '../types';
import { timeToMinutes } from './time';

export interface ScheduledSection {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  section: Section;
}

export function sectionsConflict(a: Section, b: Section): boolean {
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      const sharesDay = ma.days.some((d) => mb.days.includes(d));
      if (!sharesDay) continue;
      const aStart = timeToMinutes(ma.startTime);
      const aEnd = timeToMinutes(ma.endTime);
      const bStart = timeToMinutes(mb.startTime);
      const bEnd = timeToMinutes(mb.endTime);
      if (aStart < bEnd && bStart < aEnd) return true;
    }
  }
  return false;
}

/** Returns the set of section ids that overlap with at least one other scheduled section. */
export function findConflicts(scheduled: ScheduledSection[]): Set<string> {
  const conflictIds = new Set<string>();
  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      if (sectionsConflict(scheduled[i].section, scheduled[j].section)) {
        conflictIds.add(scheduled[i].section.id);
        conflictIds.add(scheduled[j].section.id);
      }
    }
  }
  return conflictIds;
}

export function totalUnits(scheduled: ScheduledSection[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const s of scheduled) {
    if (!seen.has(s.courseId)) {
      seen.add(s.courseId);
      sum += s.units;
    }
  }
  return sum;
}
