import { useMemo, useState } from 'react';
import type { Course } from '../types';
import { CourseResults } from './CourseResults';

interface SearchPanelProps {
  courses: Course[];
  addedSectionIds: Set<string>;
  onAdd: (courseId: string, sectionId: string) => void;
}

export interface Filters {
  subject: string;
  courseNumber: string;
  title: string;
  instructor: string;
  ge: string;
  openOnly: boolean;
}

const emptyFilters: Filters = {
  subject: '',
  courseNumber: '',
  title: '',
  instructor: '',
  ge: '',
  openOnly: false,
};

export function SearchPanel({ courses, addedSectionIds, onAdd }: SearchPanelProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const subjects = useMemo(
    () => Array.from(new Set(courses.map((c) => c.subject))).sort(),
    [courses],
  );

  const geCategories = useMemo(
    () => Array.from(new Set(courses.flatMap((c) => c.geCategories))).sort(),
    [courses],
  );

  const filtered = useMemo(() => {
    const titleQuery = filters.title.trim().toLowerCase();
    const instructorQuery = filters.instructor.trim().toLowerCase();
    const numberQuery = filters.courseNumber.trim().toLowerCase();

    return courses
      .map((course) => {
        if (filters.subject && course.subject !== filters.subject) return null;
        if (numberQuery && !course.courseNumber.toLowerCase().includes(numberQuery)) return null;
        if (titleQuery && !course.title.toLowerCase().includes(titleQuery)) return null;
        if (filters.ge && !course.geCategories.includes(filters.ge)) return null;

        let sections = course.sections;
        if (instructorQuery) {
          sections = sections.filter((s) => s.instructor.toLowerCase().includes(instructorQuery));
        }
        if (filters.openOnly) {
          sections = sections.filter((s) => s.status === 'open');
        }
        if (sections.length === 0) return null;

        return { ...course, sections };
      })
      .filter((c): c is Course => c !== null);
  }, [courses, filters]);

  return (
    <div className="search-panel">
      <h2>Search Courses</h2>
      <div className="filters">
        <label>
          Subject
          <select
            value={filters.subject}
            onChange={(e) => setFilters((f) => ({ ...f, subject: e.target.value }))}
          >
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Course #
          <input
            type="text"
            placeholder="e.g. 131"
            value={filters.courseNumber}
            onChange={(e) => setFilters((f) => ({ ...f, courseNumber: e.target.value }))}
          />
        </label>
        <label>
          Title
          <input
            type="text"
            placeholder="e.g. Data Structures"
            value={filters.title}
            onChange={(e) => setFilters((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          Instructor
          <input
            type="text"
            placeholder="e.g. Nguyen"
            value={filters.instructor}
            onChange={(e) => setFilters((f) => ({ ...f, instructor: e.target.value }))}
          />
        </label>
        <label>
          GE Category
          <select
            value={filters.ge}
            onChange={(e) => setFilters((f) => ({ ...f, ge: e.target.value }))}
          >
            <option value="">All</option>
            {geCategories.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.openOnly}
            onChange={(e) => setFilters((f) => ({ ...f, openOnly: e.target.checked }))}
          />
          Open sections only
        </label>
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Clear filters
        </button>
      </div>

      <CourseResults courses={filtered} addedSectionIds={addedSectionIds} onAdd={onAdd} />
    </div>
  );
}
