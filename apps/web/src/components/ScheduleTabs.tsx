import { useState } from 'react';
import type { ScheduleData } from '../hooks/useSchedules';

interface ScheduleTabsProps {
  schedules: ScheduleData[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function ScheduleTabs({
  schedules,
  activeId,
  onSwitch,
  onAdd,
  onRemove,
  onRename,
}: ScheduleTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startRename(schedule: ScheduleData) {
    setEditingId(schedule.id);
    setDraftName(schedule.name);
  }

  function commitRename() {
    if (editingId && draftName.trim()) {
      onRename(editingId, draftName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="schedule-tabs">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className={`schedule-tab${schedule.id === activeId ? ' schedule-tab-active' : ''}`}
        >
          {editingId === schedule.id ? (
            <input
              autoFocus
              className="schedule-tab-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="schedule-tab-label"
              onClick={() => onSwitch(schedule.id)}
              onDoubleClick={() => startRename(schedule)}
              title="Double-click to rename"
            >
              {schedule.name}
            </button>
          )}
          {schedules.length > 1 && (
            <button
              type="button"
              className="schedule-tab-close"
              onClick={() => onRemove(schedule.id)}
              title="Delete schedule"
            >
              &times;
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="schedule-tab-add"
        onClick={() => onAdd(`Schedule ${schedules.length + 1}`)}
      >
        + New
      </button>
    </div>
  );
}
