import { useMemo, useState } from 'react';
import { useCourseData } from './hooks/useCourseData';
import { useSchedules } from './hooks/useSchedules';
import { findConflicts, totalUnits, type ScheduledSection } from './lib/schedule';
import { SearchPanel } from './components/SearchPanel';
import { ScheduleGrid } from './components/ScheduleGrid';
import { ScheduleTabs } from './components/ScheduleTabs';
import { PlannerView } from './components/PlannerView';
import './App.css';

type View = 'schedule' | 'planner';

function App() {
  const [view, setView] = useState<View>('schedule');
  const { terms, courses, loading, error } = useCourseData();
  const {
    schedules,
    activeSchedule,
    activeId,
    addSection,
    removeSection,
    addSchedule,
    removeSchedule,
    switchSchedule,
    renameSchedule,
  } = useSchedules();

  const scheduledSections: ScheduledSection[] = useMemo(() => {
    return activeSchedule.selections
      .map((sel) => {
        const course = courses.find((c) => c.id === sel.courseId);
        const section = course?.sections.find((s) => s.id === sel.sectionId);
        if (!course || !section) return null;
        return {
          courseId: course.id,
          courseCode: `${course.subject} ${course.courseNumber}`,
          courseTitle: course.title,
          units: course.units,
          section,
        };
      })
      .filter((s): s is ScheduledSection => s !== null);
  }, [activeSchedule, courses]);

  const conflictIds = useMemo(() => findConflicts(scheduledSections), [scheduledSections]);
  const units = useMemo(() => totalUnits(scheduledSections), [scheduledSections]);
  const addedSectionIds = useMemo(
    () => new Set(scheduledSections.map((s) => s.section.id)),
    [scheduledSections],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>TitanTrack</h1>
        <nav className="view-tabs">
          <button
            type="button"
            className={`view-tab${view === 'schedule' ? ' view-tab-active' : ''}`}
            onClick={() => setView('schedule')}
          >
            Schedule Builder
          </button>
          <button
            type="button"
            className={`view-tab${view === 'planner' ? ' view-tab-active' : ''}`}
            onClick={() => setView('planner')}
          >
            Degree Planner
          </button>
        </nav>
        <span className="term-label">{terms[0]?.name ?? 'No term selected'}</span>
      </header>
      {loading ? (
        <div className="app-status">Loading courses…</div>
      ) : error ? (
        <div className="app-status app-status-error">Couldn't load course data: {error}</div>
      ) : view === 'planner' ? (
        <PlannerView courses={courses} />
      ) : (
        <div className="app-layout">
          <SearchPanel courses={courses} addedSectionIds={addedSectionIds} onAdd={addSection} />
          <div className="schedule-column">
            <ScheduleTabs
              schedules={schedules}
              activeId={activeId}
              onSwitch={switchSchedule}
              onAdd={addSchedule}
              onRemove={removeSchedule}
              onRename={renameSchedule}
            />
            <div className="schedule-summary">
              <span>{units} units</span>
              {conflictIds.size > 0 && (
                <span className="conflict-warning">
                  {conflictIds.size} section{conflictIds.size > 1 ? 's' : ''} conflicting
                </span>
              )}
            </div>
            <ScheduleGrid
              scheduledSections={scheduledSections}
              conflictIds={conflictIds}
              onRemove={removeSection}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
