#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (entry === 'route.ts') acc.push(full);
  }
  return acc;
}

const root = resolve(process.cwd(), 'src/app/api');
const routes = walk(root);

// Flag a route only if it reads a JSON body (request.json()) but doesn't validate it.
// Routes that use FormData (file uploads) or read no body are out of scope here — they're
// covered separately by upload-size + MIME validation.
const JSON_BODY_RE = /await\s+(?:request|req)\.json\s*\(\s*\)|parseJsonBody\s*\(/;
const ZOD_IMPORT_RE = /from\s+['"](?:zod|@\/lib\/validation\/[^'"]+)['"]/;
const ZOD_USE_RE = /\.(parse|parseAsync|safeParse|safeParseAsync)\s*\(|parseJsonBody\s*\(/;
const RAW_ERROR_RE = /NextResponse\.json\s*\(\s*\{\s*error\s*:\s*(?:String\s*\(\s*error\s*\)|`[^`]*\$\{\s*error[^}]*\}[^`]*`|error\.message|error\.toString\s*\(\s*\))/;

const failures: string[] = [];

for (const file of routes) {
  const src = readFileSync(file, 'utf8');
  if (JSON_BODY_RE.test(src)) {
    if (!ZOD_IMPORT_RE.test(src) || !ZOD_USE_RE.test(src)) {
      failures.push(`${file}: reads a JSON body but no zod validation found`);
    }
  }
  if (RAW_ERROR_RE.test(src)) {
    failures.push(`${file}: returns raw error string (String(error) / error.message / template-literal error) to client`);
  }
}

if (failures.length > 0) {
  console.error('Route validation check failed:');
  for (const f of failures) console.error('  - ' + f.replace(process.cwd() + '/', ''));
  process.exit(1);
}

console.log(`Route validation check passed (${routes.length} route files scanned).`);
