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
  waitlist_total: number;
  waitlist_taken: number;
  status: string;
}

interface MeetingRow {
  section_id: string;
  days: string[];
  start_time: string;
  end_time: string;
  location: string;
}

function assembleCourses(
  courseRows: CourseRow[],
  sectionRows: SectionRow[],
  meetingRows: MeetingRow[],
): Course[] {
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
      waitlistTotal: s.waitlist_total,
      waitlistTaken: s.waitlist_taken,
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

export interface CourseFilters {
  termId?: string;
  subject?: string;
  courseNumber?: string;
  title?: string;
  instructor?: string;
  ge?: string;
}

export async function getCourses(filters: CourseFilters = {}): Promise<Course[]> {
  const courseConditions: string[] = [];
  const courseParams: unknown[] = [];

  if (filters.termId) {
    courseParams.push(filters.termId);
    courseConditions.push(`term_id = $${courseParams.length}`);
  }
  if (filters.subject) {
    courseParams.push(filters.subject);
    courseConditions.push(`subject = $${courseParams.length}`);
  }
  if (filters.courseNumber) {
    courseParams.push(`%${filters.courseNumber}%`);
    courseConditions.push(`course_number ILIKE $${courseParams.length}`);
  }
  if (filters.title) {
    courseParams.push(`%${filters.title}%`);
    courseConditions.push(`title ILIKE $${courseParams.length}`);
  }
  if (filters.ge) {
    courseParams.push(filters.ge);
    courseConditions.push(`$${courseParams.length} = ANY(ge_categories)`);
  }

  const courseWhere = courseConditions.length ? `WHERE ${courseConditions.join(' AND ')}` : '';
  const courseRows = (
    await pool.query<CourseRow>(
      `SELECT * FROM courses ${courseWhere} ORDER BY subject, course_number`,
      courseParams,
    )
  ).rows;
  if (courseRows.length === 0) return [];

  const courseIds = courseRows.map((c) => c.id);
  const sectionParams: unknown[] = [courseIds];
  let sectionWhere = 'course_id = ANY($1)';
  if (filters.instructor) {
    sectionParams.push(`%${filters.instructor}%`);
    sectionWhere += ` AND instructor ILIKE $${sectionParams.length}`;
  }
  const sectionRows = (
    await pool.query<SectionRow>(
      `SELECT * FROM sections WHERE ${sectionWhere} ORDER BY section_number`,
      sectionParams,
    )
  ).rows;

  const sectionIds = sectionRows.map((s) => s.id);
  const meetingRows = sectionIds.length
    ? (
        await pool.query<MeetingRow>('SELECT * FROM meetings WHERE section_id = ANY($1)', [
          sectionIds,
        ])
      ).rows
    : [];

  const courses = assembleCourses(courseRows, sectionRows, meetingRows);
  // An instructor filter narrows sections, not courses — drop courses left with none matching.
  return filters.instructor ? courses.filter((c) => c.sections.length > 0) : courses;
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
    ? await pool.query<MeetingRow>('SELECT * FROM meetings WHERE section_id = ANY($1)', [
        sectionIds,
      ])
    : { rows: [] as MeetingRow[] };

  return assembleCourses(courseRows.rows, sectionRows.rows, meetingRows.rows)[0];
}

export async function sectionExists(id: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM sections WHERE id = $1', [id]);
  return rows.length > 0;
}
