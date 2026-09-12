import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id),
  days TEXT[] NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT NOT NULL
);
`;

export async function initSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
