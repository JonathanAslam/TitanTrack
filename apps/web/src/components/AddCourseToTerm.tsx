import { useMemo, useState } from 'react';
import type { CatalogCourse } from '../lib/catalog';

interface AddCourseToTermProps {
  catalog: CatalogCourse[];
  onAdd: (course: CatalogCourse) => boolean;
}

const emptyManualCourse = { subject: '', courseNumber: '', title: '', units: '' };

export function AddCourseToTerm({ catalog, onAdd }: AddCourseToTermProps) {
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);
  const [manualCourse, setManualCourse] = useState(emptyManualCourse);
  const [message, setMessage] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (c) =>
          `${c.subject} ${c.courseNumber}`.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [catalog, query]);

  function handleAdd(course: CatalogCourse) {
    const added = onAdd(course);
    setMessage(added ? null : `${course.subject} ${course.courseNumber} is already in this term.`);
    if (added) setQuery('');
  }

  function handleManualAdd() {
    const units = Number(manualCourse.units);
    if (
      !manualCourse.subject.trim() ||
      !manualCourse.courseNumber.trim() ||
      !manualCourse.title.trim() ||
      !Number.isFinite(units) ||
      units <= 0
    ) {
      setMessage('Fill in subject, course number, title, and a positive unit count.');
      return;
    }
    const added = onAdd({
      subject: manualCourse.subject.trim().toUpperCase(),
      courseNumber: manualCourse.courseNumber.trim().toUpperCase(),
      title: manualCourse.title.trim(),
      units,
    });
    setMessage(added ? null : 'That course is already in this term.');
    if (added) setManualCourse(emptyManualCourse);
  }

  return (
    <div className="add-course">
      {!manual ? (
        <>
          <div className="add-course-search">
            <input
              type="text"
              placeholder="Search catalog e.g. CPSC 131"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMessage(null);
              }}
            />
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setManual(true);
                setMessage(null);
              }}
            >
              + Custom course
            </button>
          </div>
          {matches.length > 0 && (
            <ul className="add-course-matches">
              {matches.map((c) => (
                <li key={`${c.subject}-${c.courseNumber}`}>
                  <span>
                    {c.subject} {c.courseNumber} &mdash; {c.title}
                  </span>
                  <span className="units">{c.units} units</span>
                  <button type="button" onClick={() => handleAdd(c)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="add-course-manual">
          <input
            placeholder="Subject e.g. CPSC"
            value={manualCourse.subject}
            onChange={(e) => setManualCourse((m) => ({ ...m, subject: e.target.value }))}
          />
          <input
            placeholder="Number e.g. 131"
            value={manualCourse.courseNumber}
            onChange={(e) => setManualCourse((m) => ({ ...m, courseNumber: e.target.value }))}
          />
          <input
            placeholder="Title"
            value={manualCourse.title}
            onChange={(e) => setManualCourse((m) => ({ ...m, title: e.target.value }))}
          />
          <input
            placeholder="Units"
            type="number"
            min="0"
            step="0.5"
            value={manualCourse.units}
            onChange={(e) => setManualCourse((m) => ({ ...m, units: e.target.value }))}
          />
          <button type="button" onClick={handleManualAdd}>
            Add
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setManual(false);
              setMessage(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {message && <p className="add-course-message">{message}</p>}
    </div>
  );
}
