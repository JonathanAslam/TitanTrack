import { useMemo } from 'react';
import { buildYearGroups, SESSIONS, termCredits, usePlanner } from '../hooks/usePlanner';
import { dedupeCatalog } from '../lib/catalog';
import type { Course } from '../types';
import { GeRequirementsPanel } from './GeRequirementsPanel';
import { TermCard } from './TermCard';

interface PlannerViewProps {
  courses: Course[];
}

export function PlannerView({ courses }: PlannerViewProps) {
  const {
    terms,
    years,
    targetUnits,
    totalUnits,
    toggleTerm,
    addYear,
    removeYear,
    removeTerm,
    addCourseToTerm,
    removeCourseFromTerm,
    setTargetUnits,
  } = usePlanner();

  const catalog = useMemo(() => dedupeCatalog(courses), [courses]);
  const yearGroups = useMemo(() => buildYearGroups(years, terms), [years, terms]);

  const progress = targetUnits > 0 ? Math.min(100, (totalUnits / targetUnits) * 100) : 0;

  return (
    <div className="planner">
      <div className="planner-toolbar">
        <div className="planner-progress">
          <div className="planner-progress-header">
            <span>
              <strong>{totalUnits}</strong> of{' '}
              <input
                className="target-units-input"
                type="number"
                min="0"
                value={targetUnits}
                onChange={(e) => setTargetUnits(Number(e.target.value))}
              />{' '}
              units planned
            </span>
            <span className="units-remaining">
              {Math.max(0, targetUnits - totalUnits)} units remaining
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <button type="button" className="add-year" onClick={addYear}>
          + Add Year
        </button>
      </div>

      <GeRequirementsPanel catalog={catalog} terms={terms} />

      {yearGroups.length === 0 ? (
        <p className="empty-state">No years yet — click + Add Year above to start planning.</p>
      ) : (
        yearGroups.map((group) => {
          const yearCourses = group.terms.reduce((sum, t) => sum + t.courses.length, 0);
          const yearUnits = group.terms.reduce((sum, t) => sum + termCredits(t), 0);
          return (
            <div key={group.academicYear} className="year-group">
              <div className="year-header">
                <span>
                  <strong>{group.academicYear}</strong>
                  <span className="year-range">
                    {' '}
                    ({group.academicYear}&ndash;{group.academicYear + 1})
                  </span>
                </span>
                <span className="year-header-stats">
                  {yearCourses} course{yearCourses === 1 ? '' : 's'} &middot; {yearUnits} units
                </span>
                {group.terms.length === 0 && (
                  <button
                    type="button"
                    className="year-remove"
                    onClick={() => removeYear(group.academicYear)}
                    title="Remove year"
                  >
                    &times;
                  </button>
                )}
              </div>
              <div className="term-toggle-row">
                {SESSIONS.map((session) => {
                  const active = group.terms.some((t) => t.session === session);
                  return (
                    <button
                      key={session}
                      type="button"
                      className={`term-toggle-chip ${active ? 'active' : ''}`}
                      onClick={() => toggleTerm(group.academicYear, session)}
                    >
                      {session}
                    </button>
                  );
                })}
              </div>
              {group.terms.length > 0 && (
                <div className="term-row">
                  {group.terms.map((term) => (
                    <TermCard
                      key={term.id}
                      term={term}
                      catalog={catalog}
                      onRemoveTerm={removeTerm}
                      onAddCourse={addCourseToTerm}
                      onRemoveCourse={removeCourseFromTerm}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
