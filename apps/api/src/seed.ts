import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import type { Course, Term } from '@titantrack/scraper/schema';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scraperSrcDir = path.resolve(__dirname, '../../../packages/scraper/src');
const SCRAPED_DATA_PATH = path.join(scraperSrcDir, 'scraped-data.json');
const MOCK_DATA_PATH = path.join(scraperSrcDir, 'mock-data.json');

// A full-catalog sync can be thousands of courses/sections/meetings; committing them all as one
// course-sized batch per transaction (rather than one giant transaction for the whole file) means
// a failure partway through still leaves everything up to that point durably synced — the next
// sync call re-upserts the whole file idempotently anyway, so partial progress is a pure win.
const COURSE_CHUNK_SIZE = 30;
// Multi-row INSERT batch size, kept well under Postgres's parameter-count ceiling.
const ROW_BATCH_SIZE = 300;
const SYNC_STATEMENT_TIMEOUT = "'120s'";

// Prefers real scraped data (packages/scraper/src/scraped-data.json, produced by
// `npm run scrape --workspace packages/scraper`) and falls back to the hand-written
// mock-data.json when no scrape has been run yet.
function resolveDataPath(): string {
  return existsSync(SCRAPED_DATA_PATH) ? SCRAPED_DATA_PATH : MOCK_DATA_PATH;
}

interface SeedFile {
  terms: Term[];
  courses: Course[];
  meta?: { completedSubjects?: string[]; complete?: boolean };
}

function loadSeedData(dataPath: string): SeedFile {
  return JSON.parse(readFileSync(dataPath, 'utf-8'));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Runs a multi-row `INSERT ... VALUES (...), (...) ON CONFLICT ...` in batches of `ROW_BATCH_SIZE` rows. */
async function batchInsert(
  client: PoolClient,
  buildSql: (valuesPlaceholder: string) => string,
  rows: unknown[][],
): Promise<void> {
  for (const rowBatch of chunk(rows, ROW_BATCH_SIZE)) {
    if (!rowBatch.length) continue;
    const params: unknown[] = [];
    const valuesPlaceholder = rowBatch
      .map((row) => {
        const offset = params.length;
        params.push(...row);
        return `(${row.map((_, i) => `$${offset + i + 1}`).join(', ')})`;
      })
      .join(', ');
    await client.query(buildSql(valuesPlaceholder), params);
  }
}

async function upsertTerms(client: PoolClient, terms: Term[]): Promise<void> {
  await batchInsert(
    client,
    (values) =>
      `INSERT INTO terms (id, name) VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    terms.map((term) => [term.id, term.name]),
  );
}

async function upsertCourseChunk(client: PoolClient, courses: Course[]): Promise<void> {
  await batchInsert(
    client,
    (values) =>
      `INSERT INTO courses (id, term_id, subject, course_number, title, units, ge_categories, description)
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET
         term_id = EXCLUDED.term_id,
         subject = EXCLUDED.subject,
         course_number = EXCLUDED.course_number,
         title = EXCLUDED.title,
         units = EXCLUDED.units,
         ge_categories = EXCLUDED.ge_categories,
         description = EXCLUDED.description`,
    courses.map((course) => [
      course.id,
      course.termId,
      course.subject,
      course.courseNumber,
      course.title,
      course.units,
      course.geCategories,
      course.description ?? null,
    ]),
  );

  const sections = courses.flatMap((course) =>
    course.sections.map((section) => ({ course, section })),
  );
  await batchInsert(
    client,
    (values) =>
      `INSERT INTO sections
         (id, course_id, section_number, instructor, seats_total, seats_taken, waitlist_total, waitlist_taken, status)
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET
         course_id = EXCLUDED.course_id,
         section_number = EXCLUDED.section_number,
         instructor = EXCLUDED.instructor,
         seats_total = EXCLUDED.seats_total,
         seats_taken = EXCLUDED.seats_taken,
         waitlist_total = EXCLUDED.waitlist_total,
         waitlist_taken = EXCLUDED.waitlist_taken,
         status = EXCLUDED.status`,
    sections.map(({ course, section }) => [
      section.id,
      course.id,
      section.sectionNumber,
      section.instructor,
      section.seatsTotal,
      section.seatsTaken,
      section.waitlistTotal ?? 0,
      section.waitlistTaken ?? 0,
      section.status,
    ]),
  );

  // Meetings have no natural key, so they're replaced wholesale per section rather than diffed —
  // cheap even at full-catalog scale since a section typically has only a handful of meetings.
  const sectionIds = sections.map(({ section }) => section.id);
  if (sectionIds.length) {
    await client.query('DELETE FROM meetings WHERE section_id = ANY($1)', [sectionIds]);
  }
  const meetings = sections.flatMap(({ section }) =>
    section.meetings.map((meeting) => [
      section.id,
      meeting.days,
      meeting.startTime,
      meeting.endTime,
      meeting.location,
    ]),
  );
  await batchInsert(
    client,
    (values) =>
      `INSERT INTO meetings (section_id, days, start_time, end_time, location) VALUES ${values}`,
    meetings,
  );
}

let lastSyncedMtimeMs: number | undefined;

/**
 * Upserts terms/courses/sections/meetings from the scraper's current output file into Postgres.
 * Safe to call repeatedly (a no-op if the file hasn't changed since the last call) — this is what
 * lets the API pick up new data as the scraper progresses, rather than seeding once and going
 * stale. See todo.md's "Data pipeline" section for the reasoning.
 *
 * Deliberately never deletes a term/course/section just because it's absent from the current
 * file: the scraper runs in subject-sized chunks over multiple sessions (see todo.md), so an
 * absent subject means "not scraped in this batch yet," not "no longer offered." A section's own
 * meetings ARE replaced wholesale on each sync, since meetings have no natural key to diff against
 * and are cheap to redo in full.
 *
 * Courses are upserted in `COURSE_CHUNK_SIZE`-sized batches, each its own transaction, rather than
 * one giant transaction for the whole file — at full-catalog scale (thousands of courses/sections)
 * a single failing row would otherwise roll back everything synced so far. Since this function
 * re-upserts the whole file idempotently on every call, partial progress from an earlier failure
 * is simply picked up again on the next sync.
 */
export async function syncCourseData(): Promise<{ changed: boolean }> {
  const dataPath = resolveDataPath();
  const mtimeMs = statSync(dataPath).mtimeMs;
  if (mtimeMs === lastSyncedMtimeMs) return { changed: false };

  const { terms, courses, meta } = loadSeedData(dataPath);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${SYNC_STATEMENT_TIMEOUT}`);
    try {
      await upsertTerms(client, terms);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    for (const courseChunk of chunk(courses, COURSE_CHUNK_SIZE)) {
      await client.query('BEGIN');
      await client.query(`SET LOCAL statement_timeout = ${SYNC_STATEMENT_TIMEOUT}`);
      try {
        await upsertCourseChunk(client, courseChunk);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    lastSyncedMtimeMs = mtimeMs;
    const progress = meta
      ? ` (${meta.completedSubjects?.length ?? 0} subject(s) scraped so far, ${meta.complete ? 'complete' : 'in progress'})`
      : '';
    console.log(
      `Synced course data from ${path.basename(dataPath)}: ${terms.length} term(s), ${courses.length} course(s)${progress}.`,
    );
    return { changed: true };
  } finally {
    client.release();
  }
}
