import type { Course } from '../types';

export interface CatalogCourse {
  subject: string;
  courseNumber: string;
  title: string;
  units: number;
}

/** Collapses the scraped (section-level) catalog down to one entry per course, for the planner —
 *  which tracks course names/credits toward a degree, not specific sections/terms. */
export function dedupeCatalog(courses: Course[]): CatalogCourse[] {
  const seen = new Map<string, CatalogCourse>();
  for (const c of courses) {
    const key = `${c.subject} ${c.courseNumber}`;
    if (!seen.has(key)) {
      seen.set(key, {
        subject: c.subject,
        courseNumber: c.courseNumber,
        title: c.title,
        units: c.units,
      });
    }
  }
  return [...seen.values()].sort(
    (a, b) => a.subject.localeCompare(b.subject) || a.courseNumber.localeCompare(b.courseNumber),
  );
}
