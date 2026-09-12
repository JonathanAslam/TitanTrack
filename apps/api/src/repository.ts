import type { Course, Meeting, Section, Term } from '@titantrack/scraper/schema';
import { pool } from './db.js';

interface CourseRow {
  id: string;
  term_id: string;
  subject: string;
  course_number: string;
  title: string;
  units: string;
  ge_categories: string[];
  description: string | null;
}

interface SectionRow {
  id: string;
  course_id: string;
  section_number: string;
  instructor: string;
  seats_total: number;
  seats_taken: number;
  status: string;
}

interface MeetingRow {
  section_id: string;
  days: string[];
  start_time: string;
  end_time: string;
  location: string;
}

function assembleCourses(courseRows: CourseRow[], sectionRows: SectionRow[], meetingRows: MeetingRow[]): Course[] {
  const meetingsBySection = new Map<string, Meeting[]>();
  for (const m of meetingRows) {
    const list = meetingsBySection.get(m.section_id) ?? [];
    list.push({
      days: m.days as Meeting['days'],
      startTime: m.start_time,
      endTime: m.end_time,
      location: m.location,
    });
    meetingsBySection.set(m.section_id, list);
  }

  const sectionsByCourse = new Map<string, Section[]>();
  for (const s of sectionRows) {
    const list = sectionsByCourse.get(s.course_id) ?? [];
    list.push({
      id: s.id,
      sectionNumber: s.section_number,
      instructor: s.instructor,
      meetings: meetingsBySection.get(s.id) ?? [],
      seatsTotal: s.seats_total,
      seatsTaken: s.seats_taken,
      status: s.status as Section['status'],
    });
    sectionsByCourse.set(s.course_id, list);
  }

  return courseRows.map((c) => ({
    id: c.id,
    termId: c.term_id,
    subject: c.subject,
    courseNumber: c.course_number,
    title: c.title,
    units: Number(c.units),
    geCategories: c.ge_categories,
    description: c.description ?? undefined,
    sections: sectionsByCourse.get(c.id) ?? [],
  }));
}

export async function getTerms(): Promise<Term[]> {
  const { rows } = await pool.query<Term>('SELECT id, name FROM terms ORDER BY id');
  return rows;
}

export async function getCourses(): Promise<Course[]> {
  const [courseRows, sectionRows, meetingRows] = await Promise.all([
    pool.query<CourseRow>('SELECT * FROM courses ORDER BY subject, course_number'),
    pool.query<SectionRow>('SELECT * FROM sections ORDER BY section_number'),
    pool.query<MeetingRow>('SELECT * FROM meetings'),
  ]);
  return assembleCourses(courseRows.rows, sectionRows.rows, meetingRows.rows);
}

export async function getCourseById(id: string): Promise<Course | undefined> {
  const courseRows = await pool.query<CourseRow>('SELECT * FROM courses WHERE id = $1', [id]);
  if (courseRows.rows.length === 0) return undefined;

  const sectionRows = await pool.query<SectionRow>(
    'SELECT * FROM sections WHERE course_id = $1 ORDER BY section_number',
    [id],
  );
  const sectionIds = sectionRows.rows.map((s) => s.id);
  const meetingRows = sectionIds.length
    ? await pool.query<MeetingRow>('SELECT * FROM meetings WHERE section_id = ANY($1)', [sectionIds])
    : { rows: [] as MeetingRow[] };

  return assembleCourses(courseRows.rows, sectionRows.rows, meetingRows.rows)[0];
}

export async function sectionExists(id: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM sections WHERE id = $1', [id]);
  return rows.length > 0;
}
