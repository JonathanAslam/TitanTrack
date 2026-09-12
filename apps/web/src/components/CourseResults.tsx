import type { Course } from '../types';
import { formatDays, formatTimeRange } from '../lib/time';

interface CourseResultsProps {
  courses: Course[];
  addedSectionIds: Set<string>;
  onAdd: (courseId: string, sectionId: string) => void;
}

export function CourseResults({ courses, addedSectionIds, onAdd }: CourseResultsProps) {
  if (courses.length === 0) {
    return <p className="empty-state">No courses match those filters.</p>;
  }

  return (
    <div className="course-results">
      {courses.map((course) => (
        <div key={course.id} className="course-card">
          <div className="course-card-header">
            <h3>
              {course.subject} {course.courseNumber} &mdash; {course.title}
            </h3>
            <span className="units">{course.units} units</span>
          </div>
          {course.geCategories.length > 0 && (
            <div className="ge-tags">
              {course.geCategories.map((ge) => (
                <span key={ge} className="ge-tag">
                  {ge}
                </span>
              ))}
            </div>
          )}
          <table className="sections-table">
            <thead>
              <tr>
                <th>Sec</th>
                <th>Days</th>
                <th>Time</th>
                <th>Location</th>
                <th>Instructor</th>
                <th>Enrollment</th>
                <th>Waitlist</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {course.sections.map((section) => {
                const isAdded = addedSectionIds.has(section.id);
                return (
                  <tr key={section.id}>
                    <td>{section.sectionNumber}</td>
                    <td>{section.meetings.map((m) => formatDays(m.days)).join(', ')}</td>
                    <td>
                      {section.meetings
                        .map((m) => formatTimeRange(m.startTime, m.endTime))
                        .join(', ')}
                    </td>
                    <td>{section.meetings.map((m) => m.location).join(', ')}</td>
                    <td>{section.instructor}</td>
                    <td>
                      {section.seatsTaken}/{section.seatsTotal}
                    </td>
                    <td>
                      {section.waitlistTotal > 0
                        ? `${section.waitlistTaken}/${section.waitlistTotal}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`status-badge status-${section.status}`}>
                        {section.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => onAdd(course.id, section.id)}
                      >
                        {isAdded ? 'Added' : 'Add'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
