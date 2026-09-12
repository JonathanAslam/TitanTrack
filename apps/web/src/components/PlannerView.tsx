import { useMemo, useState } from 'react';
import {
  groupByAcademicYear,
  SESSIONS,
  termCredits,
  usePlanner,
  type Session,
} from '../hooks/usePlanner';
import { dedupeCatalog } from '../lib/catalog';
import type { Course } from '../types';
import { TermCard } from './TermCard';

interface PlannerViewProps {
  courses: Course[];
}

export function PlannerView({ courses }: PlannerViewProps) {
  const {
    terms,
    targetUnits,
    totalUnits,
    addTerm,
    removeTerm,
    addCourseToTerm,
    removeCourseFromTerm,
    setTargetUnits,
  } = usePlanner();

  const catalog = useMemo(() => dedupeCatalog(courses), [courses]);
  const yearGroups = useMemo(() => groupByAcademicYear(terms), [terms]);

  const [newYear, setNewYear] = useState(() => new Date().getFullYear());
  const [newSession, setNewSession] = useState<Session>('Fall');
  const [addTermMessage, setAddTermMessage] = useState<string | null>(null);

  const progress = targetUnits > 0 ? Math.min(100, (totalUnits / targetUnits) * 100) : 0;

  function handleAddTerm() {
    const added = addTerm(newYear, newSession);
    setAddTermMessage(added ? null : `${newSession} ${newYear} is already on your plan.`);
  }

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

        <div className="add-term">
          <label>
            Year
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
            />
          </label>
          <label>
            Session
            <select value={newSession} onChange={(e) => setNewSession(e.target.value as Session)}>
              {SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleAddTerm}>
            + Add Term
          </button>
        </div>
      </div>
      {addTermMessage && <p className="add-term-message">{addTermMessage}</p>}

      {yearGroups.length === 0 ? (
        <p className="empty-state">No terms yet — add one above to start planning.</p>
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
              </div>
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
            </div>
          );
        })
      )}
    </div>
  );
}
