import { useEffect, useState } from 'react';
import { fetchCourses, fetchTerms } from '../lib/api';
import type { Course, Term } from '../types';

interface CourseDataState {
  terms: Term[];
  courses: Course[];
  loading: boolean;
  error: string | null;
}

export function useCourseData(): CourseDataState {
  const [state, setState] = useState<CourseDataState>({
    terms: [],
    courses: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTerms(), fetchCourses()])
      .then(([terms, courses]) => {
        if (cancelled) return;
        setState({ terms, courses, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load course data';
        setState({ terms: [], courses: [], loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
