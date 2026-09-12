import { useEffect, useState } from 'react';

export interface SavedSelection {
  courseId: string;
  sectionId: string;
}

export interface ScheduleData {
  id: string;
  name: string;
  selections: SavedSelection[];
}

interface PersistedState {
  schedules: ScheduleData[];
  activeId: string;
}

const STORAGE_KEY = 'titantrack.schedules.v1';

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultState(): PersistedState {
  const id = makeId();
  return { schedules: [{ id, name: 'Schedule 1', selections: [] }], activeId: id };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.schedules?.length) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

export function useSchedules() {
  const [state, setState] = useState<PersistedState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeSchedule = state.schedules.find((s) => s.id === state.activeId) ?? state.schedules[0];

  function addSection(courseId: string, sectionId: string) {
    setState((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) =>
        s.id === prev.activeId && !s.selections.some((sel) => sel.sectionId === sectionId)
          ? { ...s, selections: [...s.selections, { courseId, sectionId }] }
          : s,
      ),
    }));
  }

  function removeSection(sectionId: string) {
    setState((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) =>
        s.id === prev.activeId
          ? { ...s, selections: s.selections.filter((sel) => sel.sectionId !== sectionId) }
          : s,
      ),
    }));
  }

  function addSchedule(name: string) {
    const id = makeId();
    setState((prev) => ({
      schedules: [...prev.schedules, { id, name, selections: [] }],
      activeId: id,
    }));
  }

  function removeSchedule(id: string) {
    setState((prev) => {
      const remaining = prev.schedules.filter((s) => s.id !== id);
      const schedules = remaining.length ? remaining : [{ id: makeId(), name: 'Schedule 1', selections: [] }];
      const activeId = prev.activeId === id ? schedules[0].id : prev.activeId;
      return { schedules, activeId };
    });
  }

  function switchSchedule(id: string) {
    setState((prev) => ({ ...prev, activeId: id }));
  }

  function renameSchedule(id: string, name: string) {
    setState((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  }

  return {
    schedules: state.schedules,
    activeSchedule,
    activeId: state.activeId,
    addSection,
    removeSection,
    addSchedule,
    removeSchedule,
    switchSchedule,
    renameSchedule,
  };
}
