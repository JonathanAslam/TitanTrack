#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeCatalog } from './scrape.js';

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

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));

  if (!args.subjects && !flags.has('all-subjects')) {
    console.error(
      'Usage: npm run scrape --workspace packages/scraper -- --subjects CPSC,PHIL [--term "Fall 2026"] [--limit-per-subject 5] [--no-detail] [--out path.json]\n' +
        'Or pass --all-subjects to scrape every subject (slow, ~90 subjects — be polite about when you run this).',
    );
    process.exit(1);
  }

  const outPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.resolve(__dirname, 'scraped-data.json');

  const result = await scrapeCatalog({
    term: args.term,
    subjects: args.subjects?.split(',').map((s) => s.trim()),
    allSubjects: flags.has('all-subjects'),
    limitPerSubject: args['limit-per-subject'] ? Number(args['limit-per-subject']) : undefined,
    fetchDetails: !flags.has('no-detail'),
    delayMs: args['delay-ms'] ? Number(args['delay-ms']) : undefined,
    headed: flags.has('headed'),
    onProgress: (msg) => console.log(msg),
  });

  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `\nWrote ${result.courses.length} course(s), ${result.courses.reduce((n, c) => n + c.sections.length, 0)} section(s) to ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
