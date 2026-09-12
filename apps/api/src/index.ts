import cors from 'cors';
import express from 'express';
import { initSchema } from './db.js';
import {
  getCourseById,
  getCourses,
  getTerms,
  invalidateCoursesCache,
  sectionExists,
  type CourseFilters,
} from './repository.js';
import { syncCourseData } from './seed.js';

// How often to re-check the scraper's output file for new data (see seed.ts's syncCourseData).
// The scraper is run manually/in chunks (todo.md), so this decouples "the file changed on disk"
// from "the API needs restarting to notice" — it just polls on this cadence instead.
const COURSE_DATA_SYNC_INTERVAL_MS = Number(
  process.env.COURSE_DATA_SYNC_INTERVAL_MS ?? 15 * 60 * 1000,
);

async function syncAndInvalidateCache(): Promise<void> {
  const { changed } = await syncCourseData();
  if (changed) invalidateCoursesCache();
}

const app = express();
const port = process.env.PORT ?? 3001;

app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/terms', async (_req, res) => {
  res.json(await getTerms());
});

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

app.get('/api/courses', async (req, res) => {
  const filters: CourseFilters = {
    termId: queryString(req.query.term),
    subject: queryString(req.query.subject),
    courseNumber: queryString(req.query.courseNumber),
    title: queryString(req.query.title),
    instructor: queryString(req.query.instructor),
    ge: queryString(req.query.ge),
  };
  res.json(await getCourses(filters));
});

app.get('/api/courses/:id', async (req, res) => {
  const course = await getCourseById(req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }
  res.json(course);
});

app.get('/api/sections/:id/grades', async (req, res) => {
  if (!(await sectionExists(req.params.id))) {
    res.status(404).json({ error: 'Section not found' });
    return;
  }
  // No grade-distribution data source is wired up yet (README §6 is still open);
  // the route exists with a stable shape so the frontend can integrate against it.
  res.json({ sectionId: req.params.id, available: false, distribution: [] });
});

async function start() {
  await initSchema();
  await syncAndInvalidateCache();

  setInterval(() => {
    syncAndInvalidateCache().catch((err) => console.error('Course data sync failed', err));
  }, COURSE_DATA_SYNC_INTERVAL_MS);

  app.listen(port, () => {
    console.log(`TitanTrack API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
