/**
 * Playwright-driven scraper for CSUF's Class Search (PeopleSoft/Campus Solutions).
 *
 * The Class Search page (see README §1 / todo.md) has no JSON/XML API — every interaction is a
 * stateful `POST` to the same URL returning server-rendered HTML (classic PeopleSoft ICPanel).
 * This drives the real form with a headless browser: pick a term, iterate subjects, parse the
 * results table, then optionally drill into each class's "Class Detail" view for the fields only
 * shown there (units, GE attributes, description, seat/waitlist counts).
 */
import { chromium, type Browser, type Page } from 'playwright';
import type { Course, Day, Meeting, Section, SeatStatus, Term } from './schema.js';

const CLASS_SEARCH_URL =
  'https://cmsweb.fullerton.edu/psc/CFULPRD/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.CLASS_SEARCH.GBL?&public';

const DAY_CODES: Record<string, Day> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
};

export interface SubjectOption {
  code: string;
  label: string;
}

export interface TermOption {
  id: string;
  label: string;
}

export interface ScrapeOptions {
  /** Term label to match against the Term dropdown, e.g. "Fall 2026". Defaults to the first option. */
  term?: string;
  /** Subject codes to scrape, e.g. ["CPSC", "PHIL"]. Required unless `allSubjects` is set. */
  subjects?: string[];
  /** Scrape every subject in the dropdown. Off by default — CSUF has ~90 subjects. */
  allSubjects?: boolean;
  /** Cap the number of sections processed per subject (useful for dev/test runs). */
  limitPerSubject?: number;
  /** Drill into each class's detail view for units/description/GE/seat counts. Default true. */
  fetchDetails?: boolean;
  /** Delay between polite steps (subject searches, detail drill-ins) in ms. Default 400. */
  delayMs?: number;
  /** Run the browser headed (for debugging). Default false. */
  headed?: boolean;
  onProgress?: (message: string) => void;
}

function parseDays(daysToken: string): Day[] {
  const days: Day[] = [];
  const re = /[A-Z][a-z]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(daysToken))) {
    const day = DAY_CODES[match[0]];
    if (day) days.push(day);
  }
  return days;
}

function parseTime(time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(AM|PM)$/i.exec(time.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

/** Parses one "MoWe 8:30AM - 9:20AM" / "To Be Arranged" / "Asynchronous" line into a Meeting (minus location). */
function parseDayTimeLine(line: string): Pick<Meeting, 'days' | 'startTime' | 'endTime'> {
  const match = /^([A-Za-z]+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))$/i.exec(
    line.trim(),
  );
  if (!match) return { days: [], startTime: '', endTime: '' };
  const startTime = parseTime(match[2]) ?? '';
  const endTime = parseTime(match[3]) ?? '';
  return { days: parseDays(match[1]), startTime, endTime };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function gotoSearchPage(page: Page): Promise<void> {
  await page.goto(CLASS_SEARCH_URL, { waitUntil: 'networkidle' });
}

export async function listTerms(page: Page): Promise<TermOption[]> {
  return page.$$eval('[id^="CLASS_SRCH_WRK2_STRM"] option', (opts) =>
    opts
      .filter((o) => (o as HTMLOptionElement).value)
      .map((o) => ({ id: (o as HTMLOptionElement).value, label: o.textContent?.trim() ?? '' })),
  );
}

export async function listSubjects(page: Page): Promise<SubjectOption[]> {
  return page.$$eval('[id^="SSR_CLSRCH_WRK_SUBJECT_SRCH"] option', (opts) =>
    opts
      .filter((o) => (o as HTMLOptionElement).value)
      .map((o) => ({ code: (o as HTMLOptionElement).value, label: o.textContent?.trim() ?? '' })),
  );
}

interface ScrapedRow {
  courseHeading: string;
  classNbr: string;
  sectionNumber: string;
  dayTimeLines: string[];
  roomLines: string[];
  instructor: string;
  status: SeatStatus;
  rowIndex: number;
}

/** Parses the currently-loaded Class Search results page into per-section rows, grouped by course heading. */
async function parseResultsRows(page: Page): Promise<ScrapedRow[]> {
  return page.evaluate(() => {
    const rows: ScrapedRow[] = [];
    let currentHeading = '';
    const nodes = document.querySelectorAll<HTMLElement>(
      '[id^="SSR_CLSRSLT_WRK_GROUPBOX2$"], [id^="MTG_CLASS_NBR$"]',
    );
    nodes.forEach((el) => {
      if (el.id.startsWith('SSR_CLSRSLT_WRK_GROUPBOX2$')) {
        const title = el.getAttribute('title') || '';
        currentHeading = title.replace(/^Collapse section /, '').trim();
        return;
      }
      if (!/^MTG_CLASS_NBR\$\d+$/.test(el.id)) return; // skip the wrapping MTG_CLASS_NBR$span$N element
      const idx = el.id.split('$')[1];
      const text = (id: string) =>
        document.getElementById(`${id}$${idx}`)?.textContent?.trim() ?? '';
      const statusImg = document.querySelector<HTMLImageElement>(
        `#DERIVED_CLSRCH_SSR_STATUS_LONG\\$${idx} img`,
      );
      rows.push({
        courseHeading: currentHeading,
        classNbr: text('MTG_CLASS_NBR'),
        sectionNumber: text('MTG_CLASSNAME').split('\n')[0]?.trim() ?? '',
        dayTimeLines: text('MTG_DAYTIME')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        roomLines: text('MTG_ROOM')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        instructor: text('MTG_INSTR')
          .split('\n')
          .map((s) => s.trim().replace(/,$/, ''))
          .filter(Boolean)
          .join(', '),
        status: /wait/i.test(statusImg?.alt ?? '')
          ? 'waitlist'
          : /closed/i.test(statusImg?.alt ?? '')
            ? 'closed'
            : 'open',
        rowIndex: Number(idx),
      });
    });
    return rows;
  });
}

interface ClassDetail {
  units: number;
  geCategories: string[];
  description?: string;
  seatsTotal: number;
  seatsTaken: number;
  waitlistTotal: number;
  waitlistTaken: number;
}

async function fetchClassDetail(page: Page, rowIndex: number): Promise<ClassDetail | null> {
  const link = page.locator(`#MTG_CLASS_NBR\\$${rowIndex}`);
  if ((await link.count()) === 0) return null;
  await link.click();
  await page.waitForFunction(() => document.body.innerText.includes('Class Detail'), {
    timeout: 20000,
  });

  const detail = await page.evaluate(() => {
    const text = (id: string) => document.getElementById(id)?.textContent?.trim() ?? '';
    const unitsRaw = text('SSR_CLS_DTL_WRK_UNITS_RANGE');
    const geText = text('SSR_CLS_DTL_WRK_SSR_CRSE_ATTR_LONG');
    return {
      units: Number(/[\d.]+/.exec(unitsRaw)?.[0] ?? 0),
      geCategories: geText ? [geText.replace(/^Meets GE:\s*/i, '').trim()] : [],
      description: text('DERIVED_CLSRCH_DESCRLONG') || undefined,
      seatsTotal: Number(text('SSR_CLS_DTL_WRK_ENRL_CAP') || 0),
      seatsTaken: Number(text('SSR_CLS_DTL_WRK_ENRL_TOT') || 0),
      waitlistTotal: Number(text('SSR_CLS_DTL_WRK_WAIT_CAP') || 0),
      waitlistTaken: Number(text('SSR_CLS_DTL_WRK_WAIT_TOT') || 0),
    };
  });

  await page.click('#CLASS_SRCH_WRK2_SSR_PB_BACK');
  await page.waitForFunction(() => /class section\(s\) found/.test(document.body.innerText), {
    timeout: 20000,
  });
  return detail;
}

/** Searches one subject within the given term and returns its courses (with sections/meetings). */
export async function scrapeSubject(
  page: Page,
  termId: string,
  subjectCode: string,
  opts: Pick<ScrapeOptions, 'limitPerSubject' | 'fetchDetails' | 'delayMs' | 'onProgress'> = {},
): Promise<Course[]> {
  const { limitPerSubject, fetchDetails = true, delayMs = 400, onProgress } = opts;

  await gotoSearchPage(page);
  await page.selectOption('[id^="CLASS_SRCH_WRK2_STRM"]', termId);
  await page.selectOption('[id^="SSR_CLSRCH_WRK_SUBJECT_SRCH"]', subjectCode);
  await page.click('[id^="CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH"]');
  await page.waitForTimeout(1200);

  // "Your search will return over N classes" confirmation — only appears for large result sets.
  try {
    await page.waitForSelector('input[value="OK"]', { timeout: 3000 });
    await page.click('input[value="OK"]');
  } catch {
    // no confirmation dialog — small result set
  }

  const found = await Promise.race([
    page
      .waitForFunction(() => /class section\(s\) found/.test(document.body.innerText), {
        timeout: 20000,
      })
      .then(() => true),
    page
      .waitForFunction(() => /no classes found/i.test(document.body.innerText), { timeout: 20000 })
      .then(() => false),
  ]).catch(() => false);

  if (!found) return [];

  let rows = await parseResultsRows(page);
  if (limitPerSubject) rows = rows.slice(0, limitPerSubject);

  const coursesByKey = new Map<string, Course>();

  for (const row of rows) {
    const headingMatch = /^(\S+)\s+(\S+)\s*-\s*(.+)$/.exec(row.courseHeading);
    const subject = headingMatch?.[1] ?? subjectCode;
    const courseNumber = headingMatch?.[2] ?? '';
    const title = headingMatch?.[3] ?? row.courseHeading;
    const courseKey = `${termId}-${subject}-${courseNumber}`;

    let detail: ClassDetail | null = null;
    if (fetchDetails) {
      onProgress?.(`  ${subject} ${courseNumber} #${row.classNbr} (${row.sectionNumber})`);
      detail = await fetchClassDetail(page, row.rowIndex);
      await page.waitForTimeout(delayMs);
    }

    let course = coursesByKey.get(courseKey);
    if (!course) {
      course = {
        id: slugify(courseKey),
        termId,
        subject,
        courseNumber,
        title,
        units: detail?.units ?? 0,
        geCategories: detail?.geCategories ?? [],
        description: detail?.description,
        sections: [],
      };
      coursesByKey.set(courseKey, course);
    } else if (detail) {
      // fill in course-level fields from the first section whose detail we fetched
      if (!course.units) course.units = detail.units;
      if (course.geCategories.length === 0) course.geCategories = detail.geCategories;
      if (!course.description) course.description = detail.description;
    }

    const meetings: Meeting[] = row.dayTimeLines.map((line, i) => ({
      ...parseDayTimeLine(line),
      location: row.roomLines[i] ?? row.roomLines[0] ?? 'TBA',
    }));

    const section: Section = {
      id: row.classNbr || slugify(`${courseKey}-${row.sectionNumber}`),
      sectionNumber: row.sectionNumber,
      instructor: row.instructor || 'To Be Announced',
      meetings,
      seatsTotal: detail?.seatsTotal ?? 0,
      seatsTaken: detail?.seatsTaken ?? 0,
      waitlistTotal: detail?.waitlistTotal ?? 0,
      waitlistTaken: detail?.waitlistTaken ?? 0,
      status: row.status,
    };
    course.sections.push(section);
  }

  return [...coursesByKey.values()];
}

export async function scrapeCatalog(
  options: ScrapeOptions,
): Promise<{ terms: Term[]; courses: Course[] }> {
  const { term, subjects, allSubjects, onProgress } = options;
  if (!subjects?.length && !allSubjects) {
    throw new Error(
      'scrapeCatalog requires `subjects` (a list of subject codes) or `allSubjects: true`.',
    );
  }

  const browser: Browser = await chromium.launch({ headless: !options.headed });
  try {
    const page = await browser.newPage();
    await gotoSearchPage(page);

    const termOptions = await listTerms(page);
    const termOption = term
      ? termOptions.find((t) => t.label.toLowerCase().includes(term.toLowerCase()))
      : termOptions[0];
    if (!termOption)
      throw new Error(
        `Term "${term}" not found. Available: ${termOptions.map((t) => t.label).join(', ')}`,
      );

    const subjectOptions = await listSubjects(page);
    const targetSubjects = allSubjects
      ? subjectOptions
      : subjectOptions.filter((s) => subjects!.some((code) => code.toUpperCase() === s.code));

    onProgress?.(
      `Term: ${termOption.label} (${termOption.id}); subjects: ${targetSubjects.length}`,
    );

    const allCourses: Course[] = [];
    for (const subject of targetSubjects) {
      onProgress?.(`Scraping ${subject.code} — ${subject.label}...`);
      const courses = await scrapeSubject(page, termOption.id, subject.code, {
        limitPerSubject: options.limitPerSubject,
        fetchDetails: options.fetchDetails,
        delayMs: options.delayMs,
        onProgress,
      });
      allCourses.push(...courses);
      await page.waitForTimeout(options.delayMs ?? 400);
    }

    return { terms: [{ id: termOption.id, name: termOption.label }], courses: allCourses };
  } finally {
    await browser.close();
  }
}
