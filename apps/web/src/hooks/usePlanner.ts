import { useEffect, useState } from 'react';

export type Session = 'Fall' | 'Winter' | 'Spring' | 'Summer';

export const SESSIONS: Session[] = ['Fall', 'Winter', 'Spring', 'Summer'];

// Chronological order *within* a calendar year, matching how CSUF actually labels terms: a
// "Fall 2026" term starts August 2026, while "Winter 2027"/"Spring 2027"/"Summer 2027" all follow
// it but are labeled with the next calendar year. So within one label-year, Winter comes first.
const SESSION_ORDER: Record<Session, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };

export function isRegularSemester(session: Session): boolean {
  return session === 'Fall' || session === 'Spring';
}

export interface PlannedCourse {
  id: string;
  subject: string;
  courseNumber: string;
  title: string;
  units: number;
}

export interface PlannedTerm {
  id: string;
  year: number;
  session: Session;
  courses: PlannedCourse[];
}

interface PersistedState {
  terms: PlannedTerm[];
  targetUnits: number;
}

const STORAGE_KEY = 'titantrack.planner.v1';
const DEFAULT_TARGET_UNITS = 120;

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultState(): PersistedState {
  return { terms: [], targetUnits: DEFAULT_TARGET_UNITS };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      terms: parsed.terms ?? [],
      targetUnits: parsed.targetUnits ?? DEFAULT_TARGET_UNITS,
    };
  } catch {
    return defaultState();
  }
}

export function sortTerms(terms: PlannedTerm[]): PlannedTerm[] {
  return [...terms].sort(
    (a, b) => a.year - b.year || SESSION_ORDER[a.session] - SESSION_ORDER[b.session],
  );
}

export function termLabel(term: Pick<PlannedTerm, 'year' | 'session'>): string {
  return `${term.session} ${term.year}`;
}

export function termCredits(term: PlannedTerm): number {
  return term.courses.reduce((sum, c) => sum + c.units, 0);
}

export interface AcademicYearGroup {
  /** The Fall term's calendar year — e.g. 2026 for the "2026-2027" academic year. */
  academicYear: number;
  terms: PlannedTerm[];
}

// Left-to-right display order within a year's row of term columns — Fall first, since that's
// where the academic year starts, unlike sortTerms's calendar-chronological order used for totals.
const DISPLAY_ORDER: Record<Session, number> = { Fall: 0, Winter: 1, Spring: 2, Summer: 3 };

function academicYearOf(term: Pick<PlannedTerm, 'year' | 'session'>): number {
  return term.session === 'Fall' ? term.year : term.year - 1;
}

/** Groups terms into academic-year rows (Fall of year N through Summer of year N+1), each
 *  ordered Fall → Winter → Spring → Summer for side-by-side display. */
export function groupByAcademicYear(terms: PlannedTerm[]): AcademicYearGroup[] {
  const groups = new Map<number, PlannedTerm[]>();
  for (const term of terms) {
    const key = academicYearOf(term);
    const list = groups.get(key) ?? [];
    list.push(term);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([academicYear, groupTerms]) => ({
      academicYear,
      terms: [...groupTerms].sort((a, b) => DISPLAY_ORDER[a.session] - DISPLAY_ORDER[b.session]),
    }));
}

export function usePlanner() {
  const [state, setState] = useState<PersistedState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  /** Returns false without changing state if that term already exists. */
  function addTerm(year: number, session: Session): boolean {
    if (state.terms.some((t) => t.year === year && t.session === session)) return false;
    setState((prev) => ({
      ...prev,
      terms: [...prev.terms, { id: makeId(), year, session, courses: [] }],
    }));
    return true;
  }

  function removeTerm(termId: string) {
    setState((prev) => ({ ...prev, terms: prev.terms.filter((t) => t.id !== termId) }));
  }

  /** Returns false without changing state if that course is already on this term. */
  function addCourseToTerm(
    termId: string,
    course: Pick<PlannedCourse, 'subject' | 'courseNumber' | 'title' | 'units'>,
  ): boolean {
    const term = state.terms.find((t) => t.id === termId);
    const alreadyPlanned = term?.courses.some(
      (c) => c.subject === course.subject && c.courseNumber === course.courseNumber,
    );
    if (alreadyPlanned) return false;
    setState((prev) => ({
      ...prev,
      terms: prev.terms.map((t) =>
        t.id === termId ? { ...t, courses: [...t.courses, { id: makeId(), ...course }] } : t,
      ),
    }));
    return true;
  }

  function removeCourseFromTerm(termId: string, plannedCourseId: string) {
    setState((prev) => ({
      ...prev,
      terms: prev.terms.map((t) =>
        t.id === termId ? { ...t, courses: t.courses.filter((c) => c.id !== plannedCourseId) } : t,
      ),
    }));
  }

  function setTargetUnits(units: number) {
    setState((prev) => ({
      ...prev,
      targetUnits: Number.isFinite(units) ? Math.max(0, units) : 0,
    }));
  }

  const totalUnits = state.terms.reduce((sum, t) => sum + termCredits(t), 0);

  return {
    terms: sortTerms(state.terms),
    targetUnits: state.targetUnits,
    totalUnits,
    addTerm,
    removeTerm,
    addCourseToTerm,
    removeCourseFromTerm,
    setTargetUnits,
  };
}
