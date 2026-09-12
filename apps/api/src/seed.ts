import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Course, Term } from '@titantrack/scraper/schema';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefers real scraped data (packages/scraper/src/scraped-data.json, produced by
// `npm run scrape --workspace packages/scraper`) and falls back to the hand-written
// mock-data.json when no scrape has been run yet.
function loadSeedData(): { terms: Term[]; courses: Course[] } {
  const scraperSrcDir = path.resolve(__dirname, '../../../packages/scraper/src');
  const scrapedDataPath = path.join(scraperSrcDir, 'scraped-data.json');
  const dataPath = existsSync(scrapedDataPath)
    ? scrapedDataPath
    : path.join(scraperSrcDir, 'mock-data.json');
  console.log(`Seeding from ${path.basename(dataPath)}`);
  return JSON.parse(readFileSync(dataPath, 'utf-8'));
}

export async function seedIfEmpty(): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM terms LIMIT 1');
  if (rows.length > 0) return;

  const { terms, courses } = loadSeedData();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const term of terms) {
      await client.query('INSERT INTO terms (id, name) VALUES ($1, $2)', [term.id, term.name]);
    }

    for (const course of courses) {
      await client.query(
        `INSERT INTO courses (id, term_id, subject, course_number, title, units, ge_categories, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
    console.log(`Seeded database with ${terms.length} term(s) and ${courses.length} course(s).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
