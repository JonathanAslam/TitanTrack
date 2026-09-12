import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Course, Term } from '@titantrack/scraper/schema';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scraperSrcDir = path.resolve(__dirname, '../../../packages/scraper/src');
const SCRAPED_DATA_PATH = path.join(scraperSrcDir, 'scraped-data.json');
const MOCK_DATA_PATH = path.join(scraperSrcDir, 'mock-data.json');

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
 */
export async function syncCourseData(): Promise<{ changed: boolean }> {
  const dataPath = resolveDataPath();
  const mtimeMs = statSync(dataPath).mtimeMs;
  if (mtimeMs === lastSyncedMtimeMs) return { changed: false };

  const { terms, courses, meta } = loadSeedData(dataPath);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const term of terms) {
      await client.query(
        `INSERT INTO terms (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [term.id, term.name],
      );
    }

    for (const course of courses) {
      await client.query(
        `INSERT INTO courses (id, term_id, subject, course_number, title, units, ge_categories, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           term_id = EXCLUDED.term_id,
           subject = EXCLUDED.subject,
           course_number = EXCLUDED.course_number,
           title = EXCLUDED.title,
           units = EXCLUDED.units,
           ge_categories = EXCLUDED.ge_categories,
           description = EXCLUDED.description`,
        [
          course.id,
          course.termId,
          course.subject,
          course.courseNumber,
          course.title,
          course.units,
          course.geCategories,
          course.description ?? null,
        ],
      );

      for (const section of course.sections) {
        await client.query(
          `INSERT INTO sections
             (id, course_id, section_number, instructor, seats_total, seats_taken, waitlist_total, waitlist_taken, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             course_id = EXCLUDED.course_id,
             section_number = EXCLUDED.section_number,
             instructor = EXCLUDED.instructor,
             seats_total = EXCLUDED.seats_total,
             seats_taken = EXCLUDED.seats_taken,
             waitlist_total = EXCLUDED.waitlist_total,
             waitlist_taken = EXCLUDED.waitlist_taken,
             status = EXCLUDED.status`,
          [
            section.id,
            course.id,
            section.sectionNumber,
            section.instructor,
            section.seatsTotal,
            section.seatsTaken,
            section.waitlistTotal ?? 0,
            section.waitlistTaken ?? 0,
            section.status,
          ],
        );

        await client.query('DELETE FROM meetings WHERE section_id = $1', [section.id]);
        for (const meeting of section.meetings) {
          await client.query(
            `INSERT INTO meetings (section_id, days, start_time, end_time, location)
             VALUES ($1, $2, $3, $4, $5)`,
            [section.id, meeting.days, meeting.startTime, meeting.endTime, meeting.location],
          );
        }
      }
    }

    await client.query('COMMIT');
    lastSyncedMtimeMs = mtimeMs;
    const progress = meta
      ? ` (${meta.completedSubjects?.length ?? 0} subject(s) scraped so far, ${meta.complete ? 'complete' : 'in progress'})`
      : '';
    console.log(
      `Synced course data from ${path.basename(dataPath)}: ${terms.length} term(s), ${courses.length} course(s)${progress}.`,
    );
    return { changed: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
