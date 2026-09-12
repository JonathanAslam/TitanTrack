import { isRegularSemester, termCredits, termLabel, type PlannedTerm } from '../hooks/usePlanner';
import type { CatalogCourse } from '../lib/catalog';
import { AddCourseToTerm } from './AddCourseToTerm';

interface TermCardProps {
  term: PlannedTerm;
  catalog: CatalogCourse[];
  onRemoveTerm: (termId: string) => void;
  onAddCourse: (termId: string, course: CatalogCourse) => boolean;
  onRemoveCourse: (termId: string, plannedCourseId: string) => void;
}

export function TermCard({
  term,
  catalog,
  onRemoveTerm,
  onAddCourse,
  onRemoveCourse,
}: TermCardProps) {
  return (
    <div className="term-card">
      <div className="term-card-header">
        <h3>{termLabel(term)}</h3>
        <span className="term-type-badge">
          {isRegularSemester(term.session) ? 'Semester' : 'Session'}
        </span>
        <span className="units">{termCredits(term)} units</span>
        <button
          type="button"
          className="term-remove"
          onClick={() => onRemoveTerm(term.id)}
          title="Remove term"
        >
          &times;
        </button>
      </div>

      <div className="term-card-body">
        {term.courses.length === 0 ? (
          <p className="empty-state">No courses planned yet.</p>
        ) : (
          <ul className="term-course-list">
            {term.courses.map((c) => (
              <li key={c.id}>
                <div className="term-course-row">
                  <span className="term-course-code">
                    {c.subject} {c.courseNumber}
                  </span>
                  <button
                    type="button"
                    className="term-remove"
                    onClick={() => onRemoveCourse(term.id, c.id)}
                    title="Remove course"
                  >
                    &times;
                  </button>
                </div>
                <div className="term-course-title">{c.title}</div>
                {c.geCategories.length > 0 && (
                  <div className="ge-tags">
                    {c.geCategories.map((ge) => (
                      <span key={ge} className="ge-tag">
                        {ge}
                      </span>
                    ))}
                  </div>
                )}
                <div className="units">{c.units} units</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddCourseToTerm catalog={catalog} onAdd={(course) => onAddCourse(term.id, course)} />
    </div>
  );
}
