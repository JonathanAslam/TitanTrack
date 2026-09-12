import type { Day } from '../types';
import type { ScheduledSection } from '../lib/schedule';
import { formatTimeRange, timeToMinutes } from '../lib/time';

interface ScheduleGridProps {
  scheduledSections: ScheduledSection[];
  conflictIds: Set<string>;
  onRemove: (sectionId: string) => void;
}

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS: Record<Day, string> = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
};
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface Block {
  key: string;
  day: Day;
  top: number;
  height: number;
  label: string;
  timeLabel: string;
  location: string;
  hasConflict: boolean;
  sectionId: string;
}

function buildBlocks(scheduledSections: ScheduledSection[], conflictIds: Set<string>): Block[] {
  const blocks: Block[] = [];
  for (const { courseCode, section } of scheduledSections) {
    for (const meeting of section.meetings) {
      const startMin = timeToMinutes(meeting.startTime) - START_HOUR * 60;
      const endMin = timeToMinutes(meeting.endTime) - START_HOUR * 60;
      const top = (startMin / TOTAL_MINUTES) * 100;
      const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
      for (const day of meeting.days) {
        if (!DAYS.includes(day)) continue;
        blocks.push({
          key: `${section.id}-${day}`,
          day,
          top,
          height,
          label: `${courseCode} (${section.sectionNumber})`,
          timeLabel: formatTimeRange(meeting.startTime, meeting.endTime),
          location: meeting.location,
          hasConflict: conflictIds.has(section.id),
          sectionId: section.id,
        });
      }
    }
  }
  return blocks;
}

export function ScheduleGrid({ scheduledSections, conflictIds, onRemove }: ScheduleGridProps) {
  const blocks = buildBlocks(scheduledSections, conflictIds);

  return (
    <div className="schedule-grid-wrapper">
      <div className="schedule-grid">
        <div className="time-column">
          <div className="grid-header" />
          {HOURS.map((h) => (
            <div key={h} className="hour-label">
              {h % 12 === 0 ? 12 : h % 12}
              {h >= 12 ? 'pm' : 'am'}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="day-column">
            <div className="grid-header">{DAY_LABELS[day]}</div>
            <div className="day-column-body">
              {blocks
                .filter((b) => b.day === day)
                .map((b) => (
                  <div
                    key={b.key}
                    className={`schedule-block${b.hasConflict ? ' schedule-block-conflict' : ''}`}
                    style={{ top: `${b.top}%`, height: `${b.height}%` }}
                    onClick={() => onRemove(b.sectionId)}
                    title="Click to remove from schedule"
                  >
                    <div className="schedule-block-label">{b.label}</div>
                    <div className="schedule-block-meta">{b.timeLabel}</div>
                    <div className="schedule-block-meta">{b.location}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {scheduledSections.length === 0 && (
        <p className="empty-state">No sections added yet — search for courses and click "Add".</p>
      )}
    </div>
  );
}
