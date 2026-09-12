import { useMemo } from 'react';
import type { PlannedCourse, PlannedTerm } from '../hooks/usePlanner';
import { termLabel } from '../hooks/usePlanner';
import type { CatalogCourse } from '../lib/catalog';

interface GeRequirementsPanelProps {
  catalog: CatalogCourse[];
  terms: PlannedTerm[];
}

interface CategoryRow {
  category: string;
  satisfiedBy: Array<{ course: PlannedCourse; term: PlannedTerm }>;
}

export function GeRequirementsPanel({ catalog, terms }: GeRequirementsPanelProps) {
  const rows = useMemo<CategoryRow[]>(() => {
    const categories = [...new Set(catalog.flatMap((c) => c.geCategories))].sort();
    return categories.map((category) => ({
      category,
      satisfiedBy: terms.flatMap((term) =>
        term.courses
          .filter((course) => course.geCategories.includes(category))
          .map((course) => ({ course, term })),
      ),
    }));
  }, [catalog, terms]);

  if (rows.length === 0) return null;

  const satisfiedCount = rows.filter((r) => r.satisfiedBy.length > 0).length;

  return (
    <div className="ge-panel">
      <div className="ge-panel-header">
        <h3>GE Requirements</h3>
        <span className="ge-panel-stats">
          {satisfiedCount} of {rows.length} covered
        </span>
      </div>
      <ul className="ge-category-list">
        {rows.map(({ category, satisfiedBy }) => (
          <li
            key={category}
            className={`ge-category-row ${satisfiedBy.length > 0 ? 'satisfied' : 'unsatisfied'}`}
          >
            <span className="ge-category-name">{category}</span>
            {satisfiedBy.length > 0 ? (
              <span className="ge-category-courses">
                {satisfiedBy
                  .map(
                    ({ course, term }) =>
                      `${course.subject} ${course.courseNumber} (${termLabel(term)})`,
                  )
                  .join(', ')}
              </span>
            ) : (
              <span className="ge-category-courses">Not yet planned</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
