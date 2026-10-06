// ML-477: writes the app's security headers into vercel.json.
//
// On Vercel the pages (everything in public/) are served as static files and never pass through
// Express, so the headers set in server/middleware/securityHeaders.js only reach the data answers
// (/api/..., /auth/...). vercel.json's "headers" is what puts them on the pages too. This script copies
// the one list into it, so the two can't drift; server/test/vercelHeaders.test.js fails if they have.
//
// Usage: npm run sync-vercel-headers             (the content security policy as report-only)
//        npm run sync-vercel-headers -- --enforce (enforced - only together with CSP_ENFORCE=true, ML-474)
import { readFileSync, writeFileSync } from 'node:fs';
import { securityHeaders } from '../server/middleware/securityHeaders.js';

const SOURCE = '/(.*)'; // every address: the pages, and the data answers too (the same values)

const file = new URL('../vercel.json', import.meta.url);
const text = readFileSync(file, 'utf8');
const config = JSON.parse(text);
const headers = Object.entries(securityHeaders({ enforceCsp: process.argv.includes('--enforce') })).map(([key, value]) => ({ key, value }));
const others = (config.headers || []).filter((h) => h.source !== SOURCE);
const { rewrites, ...rest } = config;
const out = JSON.stringify({ ...rest, headers: [{ source: SOURCE, headers }, ...others], ...(rewrites ? { rewrites } : {}) }, null, 2) + '\n';
writeFileSync(file, text.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out);
console.log(`vercel.json: ${headers.length} security headers written for ${SOURCE}`);
