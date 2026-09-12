import type { Course } from '../types';

export interface CatalogCourse {
  subject: string;
  courseNumber: string;
  title: string;
  units: number;
  geCategories: string[];
}

/** Collapses the scraped (section-level) catalog down to one entry per course, for the planner —
 *  which tracks course names/credits toward a degree, not specific sections/terms. GE categories
 *  are unioned across rows since tagging can vary slightly term-to-term. */
export function dedupeCatalog(courses: Course[]): CatalogCourse[] {
  const seen = new Map<string, CatalogCourse>();
  for (const c of courses) {
    const key = `${c.subject} ${c.courseNumber}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        subject: c.subject,
        courseNumber: c.courseNumber,
        title: c.title,
        units: c.units,
        geCategories: [...new Set(c.geCategories)],
      });
    } else {
      existing.geCategories = [...new Set([...existing.geCategories, ...c.geCategories])];
    }
  }
  return [...seen.values()].sort(
    (a, b) => a.subject.localeCompare(b.subject) || a.courseNumber.localeCompare(b.courseNumber),
  );
}
