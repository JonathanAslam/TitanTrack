#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeCatalog } from './scrape.js';
import type { Course, Term } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      flags.add(key);
    }
  }
  return { args, flags };
}

interface OutputFile {
  terms: Term[];
  courses: Course[];
  meta: {
    term: string | undefined;
    completedSubjects: string[];
    failedSubjects: string[];
    /** Subjects whose "over 50 classes" confirmation never dismisses (see OversizedSubjectError) —
     *  permanently excluded from --resume/--max-subjects, unlike failedSubjects which keep retrying.
     *  Needs manual data entry; see todo.md. */
    oversizedSubjects: string[];
    updatedAt: string;
    complete: boolean;
  };
}

function loadCheckpoint(outPath: string, term: string | undefined): OutputFile | null {
  if (!existsSync(outPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(outPath, 'utf-8')) as Partial<OutputFile>;
    if (!parsed.meta) {
      console.warn(`--resume: ${outPath} has no checkpoint metadata — starting fresh.`);
      return null;
    }
    if (parsed.meta.term !== term) {
      console.warn(
        `--resume: checkpoint term "${parsed.meta.term}" != --term "${term}" — starting fresh.`,
      );
      return null;
    }
    if (parsed.meta.complete) {
      console.warn(`--resume: checkpoint at ${outPath} is already complete — starting fresh.`);
      return null;
    }
    return parsed as OutputFile;
  } catch (err) {
    console.warn(
      `--resume: failed to parse ${outPath} (${(err as Error).message}) — starting fresh.`,
    );
    return null;
  }
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));

  if (!args.subjects && !flags.has('all-subjects')) {
    console.error(
      'Usage: npm run scrape --workspace packages/scraper -- --subjects CPSC,PHIL [--term "Fall 2026"]\n' +
        '  [--limit-per-subject 5] [--no-detail] [--delay-ms N] [--out path.json] [--resume] [--max-subjects N]\n' +
        'Or pass --all-subjects to scrape every subject (slow, ~90 subjects — be polite about when you run this).\n' +
        "  --resume        continue an interrupted run from --out's checkpoint, skipping completed subjects\n" +
        '  --max-subjects  cap how many not-yet-completed subjects this run attempts (for chunking --all-subjects)',
    );
    process.exit(1);
  }

  const outPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.resolve(__dirname, 'scraped-data.json');

  const checkpoint = flags.has('resume') ? loadCheckpoint(outPath, args.term) : null;
  if (checkpoint) {
    console.log(
      `Resuming from checkpoint: ${checkpoint.meta.completedSubjects.length} subject(s) already done, ` +
        `${checkpoint.courses.length} course(s) so far.`,
    );
  }

  const courses: Course[] = checkpoint ? [...checkpoint.courses] : [];
  const completedSubjects: string[] = checkpoint ? [...checkpoint.meta.completedSubjects] : [];
  const oversizedSubjects: string[] = checkpoint
    ? [...(checkpoint.meta.oversizedSubjects ?? [])]
    : [];
  let terms: Term[] = checkpoint?.terms ?? [];

  const writeCheckpoint = (complete: boolean, failedSubjects: string[]) => {
    const output: OutputFile = {
      terms,
      courses,
      meta: {
        term: args.term,
        completedSubjects,
        failedSubjects,
        oversizedSubjects,
        updatedAt: new Date().toISOString(),
        complete,
      },
    };
    writeFileSync(outPath, JSON.stringify(output, null, 2));
  };

  const result = await scrapeCatalog({
    term: args.term,
    subjects: args.subjects?.split(',').map((s) => s.trim()),
    allSubjects: flags.has('all-subjects'),
    limitPerSubject: args['limit-per-subject'] ? Number(args['limit-per-subject']) : undefined,
    fetchDetails: !flags.has('no-detail'),
    delayMs: args['delay-ms'] ? Number(args['delay-ms']) : undefined,
    headed: flags.has('headed'),
    // Oversized subjects are a permanent, non-retryable terminal state (see OversizedSubjectError)
    // — skip them just like completed ones so --resume/--max-subjects never wastes time on them.
    skipSubjects: [...completedSubjects, ...oversizedSubjects],
    maxSubjects: args['max-subjects'] ? Number(args['max-subjects']) : undefined,
    onProgress: (msg) => console.log(msg),
    onTermResolved: (resolvedTerm) => {
      terms = [resolvedTerm];
    },
    onSubjectComplete: ({ subject, courses: subjectCourses, error, oversized }) => {
      if (oversized) {
        oversizedSubjects.push(subject.code);
      } else if (!error) {
        courses.push(...subjectCourses);
        completedSubjects.push(subject.code);
      }
      // Flush after every subject so a crash mid-run loses at most one subject's work, not the
      // whole run — see todo.md's "no checkpointing" note.
      writeCheckpoint(false, []);
    },
  });

  terms = result.terms;
  writeCheckpoint(result.failedSubjects.length === 0, result.failedSubjects);

  console.log(
    `\nWrote ${courses.length} course(s), ${courses.reduce((n, c) => n + c.sections.length, 0)} section(s) to ${outPath}`,
  );
  if (result.failedSubjects.length) {
    console.log(
      `${result.failedSubjects.length} subject(s) failed and were skipped: ${result.failedSubjects.join(', ')}\n` +
        `Re-run with the same --out and --resume to retry just those.`,
    );
  }
  if (result.oversizedSubjects.length) {
    console.log(
      `${result.oversizedSubjects.length} subject(s) exceed the search result limit and need manual ` +
        `data entry (won't be retried automatically): ${result.oversizedSubjects.join(', ')}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
