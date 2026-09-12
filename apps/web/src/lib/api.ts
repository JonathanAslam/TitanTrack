import type { Course, Term } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchTerms(): Promise<Term[]> {
  return fetchJson<Term[]>('/api/terms');
}

export function fetchCourses(): Promise<Course[]> {
  return fetchJson<Course[]>('/api/courses');
}
