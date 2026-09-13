import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Managed Postgres (Supabase, Render, etc.) requires SSL over its connection string.
// Local/docker-compose Postgres has no SSL cert configured, so only opt in for non-local hosts
// rather than naming a specific provider — this keeps working across whichever host DATABASE_URL
// points at.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'db']);

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export const pool = new Pool({
  connectionString,
  ssl: isLocalDatabase(connectionString) ? undefined : { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  term_id TEXT NOT NULL REFERENCES terms(id),
  subject TEXT NOT NULL,
  course_number TEXT NOT NULL,
  title TEXT NOT NULL,
  units NUMERIC NOT NULL,
  ge_categories TEXT[] NOT NULL DEFAULT '{}',
  description TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  section_number TEXT NOT NULL,
  instructor TEXT NOT NULL,
  seats_total INTEGER NOT NULL,
  seats_taken INTEGER NOT NULL,
  waitlist_total INTEGER NOT NULL DEFAULT 0,
  waitlist_taken INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);

ALTER TABLE sections ADD COLUMN IF NOT EXISTS waitlist_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS waitlist_taken INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  days TEXT[] NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_subject_number ON courses(subject, course_number);
CREATE INDEX IF NOT EXISTS idx_courses_term_id ON courses(term_id);
CREATE INDEX IF NOT EXISTS idx_courses_ge_categories ON courses USING GIN(ge_categories);
CREATE INDEX IF NOT EXISTS idx_sections_course_id ON sections(course_id);
CREATE INDEX IF NOT EXISTS idx_meetings_section_id ON meetings(section_id);
`;

export async function initSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
