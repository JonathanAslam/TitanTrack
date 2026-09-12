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
  geCategories: string[];
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
  /** Academic years the user has explicitly added, so an empty year can still be shown with its
   *  term toggles before any term exists for it. Years implied by existing terms don't need to be
   *  listed here — see the `years` derivation in usePlanner(). */
  years: number[];
}

const STORAGE_KEY = 'titantrack.planner.v1';
const DEFAULT_TARGET_UNITS = 120;

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultState(): PersistedState {
  return { terms: [], targetUnits: DEFAULT_TARGET_UNITS, years: [] };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      terms: parsed.terms ?? [],
      targetUnits: parsed.targetUnits ?? DEFAULT_TARGET_UNITS,
      years: parsed.years ?? [],
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

function academicYearOf(term: Pick<PlannedTerm, 'year' | 'session'>): number {
  return term.session === 'Fall' ? term.year : term.year - 1;
}

/** Builds one row per academic year in `years` (Fall of year N through Summer of year N+1), even
 *  if a year has no terms yet — so its term toggles can still render. Within a year, `sortTerms`
 *  already yields Fall → Winter → Spring → Summer, since Fall's calendar year is lower than the
 *  others' (which are labeled with year N+1). */
export function buildYearGroups(years: number[], terms: PlannedTerm[]): AcademicYearGroup[] {
  const byYear = new Map<number, PlannedTerm[]>();
  for (const term of terms) {
    const key = academicYearOf(term);
    byYear.set(key, [...(byYear.get(key) ?? []), term]);
  }
  return [...years]
    .sort((a, b) => a - b)
    .map((academicYear) => ({
      academicYear,
      terms: sortTerms(byYear.get(academicYear) ?? []),
    }));
}

export function usePlanner() {
  const [state, setState] = useState<PersistedState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Union of explicitly-added years and years implied by existing terms, so old localStorage
  // data (terms but no `years` array) still displays correctly with no migration step.
  const years = [...new Set([...state.years, ...state.terms.map(academicYearOf)])].sort(
    (a, b) => a - b,
  );

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

  /** Toggles the term for (academicYear, session) on or off — adds it if missing, removes it
   *  (and its courses) if it already exists. */
  function toggleTerm(academicYear: number, session: Session) {
    const calendarYear = session === 'Fall' ? academicYear : academicYear + 1;
    const existing = state.terms.find((t) => t.year === calendarYear && t.session === session);
    if (existing) {
      removeTerm(existing.id);
    } else {
      addTerm(calendarYear, session);
    }
  }

  /** Appends the academic year after the latest one the user has (current calendar year if none
   *  yet). Computed from the derived `years` below, not raw persisted state, so it can't silently
   *  no-op by picking a year already implied by an existing term. */
  function addYear() {
    const latest = years.length ? Math.max(...years) : new Date().getFullYear() - 1;
    setState((prev) => ({ ...prev, years: [...prev.years, latest + 1] }));
  }

  /** No-ops if any term still exists for that academic year — only an empty year is removable. */
  function removeYear(academicYear: number) {
    const hasTerms = state.terms.some((t) => academicYearOf(t) === academicYear);
    if (hasTerms) return;
    setState((prev) => ({ ...prev, years: prev.years.filter((y) => y !== academicYear) }));
  }

  /** Returns false without changing state if that course is already on this term. */
  function addCourseToTerm(
    termId: string,
    course: Pick<PlannedCourse, 'subject' | 'courseNumber' | 'title' | 'units' | 'geCategories'>,
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
    years,
    targetUnits: state.targetUnits,
    totalUnits,
    addTerm,
    removeTerm,
    toggleTerm,
    addYear,
    removeYear,
    addCourseToTerm,
    removeCourseFromTerm,
    setTargetUnits,
  };
}
