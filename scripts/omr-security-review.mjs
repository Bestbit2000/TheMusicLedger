#!/usr/bin/env node
// ML-192: the tool half of a deep ("assisted") security review of solfascribe-omr - the checks Admin
// -> Security can't run from Vercel. Clones the upstream repo into a scratch folder (never touches
// this repo or theirs), runs the scanners, and writes a draft summary for the reviewer. The other
// half - the manual read and the judgement calls - is done by Claude Code in a session; see
// .claude/skills/omr-security-review/SKILL.md and docs/omr-security-review.md.
//
//   node scripts/omr-security-review.mjs [--ref <commit>] [--tools <dir>] [--out <dir>]
//
// Tools (not installed by this script - download them yourself, checksum-verified, see the skill):
//   gitleaks, osv-scanner  - found on PATH or in --tools <dir>. Missing ones are reported "not run".
//   ESLint + eslint-plugin-security - npm-installed into the scratch folder (from the npm registry).
// Output: <out>/draft-run.json (plus each tool's raw report next to it).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = 'https://github.com/James-Aidoo/solfascribe-omr.git';
const argv = process.argv.slice(2);
const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const toolsDir = arg('--tools');
const outDir = path.resolve(arg('--out') || path.join(os.tmpdir(), `omr-security-review-${new Date().toISOString().slice(0, 10)}`));
const isWin = process.platform === 'win32';

// Never goes through a shell: every argument is passed as-is.
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false, ...opts });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '', error: r.error };
}
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
// Node >= 22 refuses to spawn .cmd files without a shell; route those through cmd.exe explicitly.
function runNode(cmd, args, opts) {
  return isWin ? run('cmd.exe', ['/d', '/s', '/c', cmd, ...args], opts) : run(cmd, args, opts);
}

function findTool(name) {
  const exe = isWin ? `${name}.exe` : name;
  const candidates = [];
  if (toolsDir) {
    for (const f of fs.existsSync(toolsDir) ? fs.readdirSync(toolsDir) : []) {
      if (f === exe || (f.startsWith(name) && f.endsWith(isWin ? '.exe' : ''))) candidates.push(path.join(toolsDir, f));
    }
  }
  candidates.push(exe);
  for (const c of candidates) {
    // gitleaks has a `version` subcommand; osv-scanner v2 only answers --version.
    for (const flag of ['version', '--version']) {
      const r = run(c, [flag]);
      if (!r.error && r.code === 0) return { path: c, version: (r.out || r.err).trim().split('\n')[0].replace(/^.*version:\s*/, '') };
    }
  }
  return null;
}

fs.mkdirSync(outDir, { recursive: true });
const clone = path.join(outDir, 'omr');
const draft = { generatedAt: new Date().toISOString(), repo: REPO, tools: [], results: {} };

console.log(`Scratch folder: ${outDir}`);
if (!fs.existsSync(path.join(clone, '.git'))) {
  const c = run('git', ['clone', '-q', REPO, clone]);
  if (c.code !== 0) { console.error(c.err); process.exit(1); }
}
if (arg('--ref')) run('git', ['-C', clone, 'checkout', '-q', arg('--ref')]);
draft.upstreamCommitSha = run('git', ['-C', clone, 'rev-parse', 'HEAD']).out.trim();
draft.commitCount = Number(run('git', ['-C', clone, 'rev-list', '--count', 'HEAD']).out.trim());
draft.sourceLines = Object.fromEntries(fs.readdirSync(path.join(clone, 'src')).filter((f) => f.endsWith('.ts'))
  .map((f) => [f, fs.readFileSync(path.join(clone, 'src', f), 'utf8').split('\n').length - 1]));
draft.reviewNoteReferences = run('git', ['-C', clone, 'grep', '-c', '-E', 'security review 2026-09-15|review note']).out.trim().split('\n').filter(Boolean);
console.log(`Upstream ${draft.upstreamCommitSha} (${draft.commitCount} commits)`);

// Secrets - full history, then the working tree.
const gitleaks = findTool('gitleaks');
if (gitleaks) {
  draft.tools.push(`Gitleaks ${gitleaks.version}`);
  const history = run(gitleaks.path, ['git', clone, '--no-banner', '--report-format', 'json', '--report-path', path.join(outDir, 'gitleaks-git.json')]);
  const tree = run(gitleaks.path, ['dir', clone, '--no-banner', '--report-format', 'json', '--report-path', path.join(outDir, 'gitleaks-dir.json')]);
  const count = (f) => { try { return JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')).length; } catch { return null; } };
  draft.results['secrets-history'] = { exitCodes: [history.code, tree.code], leaksInHistory: count('gitleaks-git.json'), leaksInTree: count('gitleaks-dir.json') };
} else {
  draft.results['secrets-history'] = { notRun: 'gitleaks not found - see the skill for the download' };
}

// Dependencies - npm audit (all / production only) and OSV-Scanner over the lockfile.
const auditAll = runNode(npmCmd, ['audit', '--package-lock-only', '--json'], { cwd: clone });
const auditProd = runNode(npmCmd, ['audit', '--package-lock-only', '--omit=dev', '--json'], { cwd: clone });
const vulnCount = (r) => { try { return JSON.parse(r.out).metadata.vulnerabilities; } catch { return null; } };
draft.results['npm-audit'] = { all: vulnCount(auditAll), productionOnly: vulnCount(auditProd) };
draft.tools.push(`npm audit (npm ${runNode(npmCmd, ['-v']).out.trim()})`);
const osv = findTool('osv-scanner');
if (osv) {
  draft.tools.push(`OSV-Scanner ${osv.version}`);
  const r = run(osv.path, ['scan', 'source', '-r', '--format', 'json', clone]);
  fs.writeFileSync(path.join(outDir, 'osv-scanner.json'), r.out);
  try {
    const report = JSON.parse(r.out);
    draft.results['npm-audit'].osvScanner = (report.results || []).flatMap((res) => res.packages || [])
      .flatMap((p) => (p.vulnerabilities || []).map((v) => `${p.package.name}@${p.package.version}: ${v.id}`));
  } catch {
    draft.results['npm-audit'].osvScanner = `unparseable output (exit ${r.code})`;
  }
} else {
  draft.results['npm-audit'].osvScanner = 'not run - osv-scanner not found';
}

// Audiveris (Java) - the version the Dockerfile builds, and its declared dependencies vs OSV.
process.env.DATABASE_URL ??= 'postgres://unused@localhost/unused'; // securityReview.js imports the pool; nothing queries it
const { gradleDependencies } = await import('../server/services/securityReview.js');
const audiverisVersion = fs.readFileSync(path.join(clone, 'Dockerfile'), 'utf8').match(/ARG\s+AUDIVERIS_VERSION=(\S+)/)?.[1];
if (audiverisVersion) {
  const gradle = await (await fetch(`https://raw.githubusercontent.com/Audiveris/audiveris/${audiverisVersion}/app/build.gradle`)).text();
  const deps = gradleDependencies(gradle);
  const batch = await (await fetch('https://api.osv.dev/v1/querybatch', { method: 'POST', body: JSON.stringify({ queries: deps.map((d) => ({ package: { ecosystem: 'Maven', name: d.name }, version: d.version })) }) })).json();
  const tag = run('git', ['ls-remote', 'https://github.com/Audiveris/audiveris.git', `refs/tags/${audiverisVersion}`]).out.split(/\s/)[0];
  draft.audiveris = { version: audiverisVersion, commitSha: tag || null };
  draft.results['java-dependencies'] = { declared: deps.length, advisories: batch.results.flatMap((r, i) => (r.vulns || []).map((v) => `${deps[i].name}@${deps[i].version}: ${v.id}`)) };
}

// Static analysis - ESLint + eslint-plugin-security on a copy of the source (the clone has no
// ESLint config of its own; ours is written next to it).
const lintDir = path.join(outDir, 'eslint');
fs.mkdirSync(lintDir, { recursive: true });
if (!fs.existsSync(path.join(lintDir, 'node_modules', 'eslint-plugin-security'))) {
  fs.writeFileSync(path.join(lintDir, 'package.json'), '{"name":"omr-lint","private":true,"type":"module"}');
  runNode(npmCmd, ['install', '--silent', 'eslint@9', 'eslint-plugin-security', 'typescript-eslint', 'typescript'], { cwd: lintDir });
}
fs.writeFileSync(path.join(lintDir, 'eslint.config.mjs'), `import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';
export default [
  { files: ['**/*.ts', '**/*.mjs'], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } } },
  security.configs.recommended,
];
`);
const target = path.join(lintDir, 'target');
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(path.join(clone, 'src'), path.join(target, 'src'), { recursive: true });
const lint = runNode(npxCmd, ['eslint', '-c', 'eslint.config.mjs', '-f', 'json', 'target/src'], { cwd: lintDir });
try {
  const byRule = {};
  const findings = [];
  for (const f of JSON.parse(lint.out)) {
    for (const m of f.messages) {
      byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
      findings.push(`${path.relative(target, f.filePath)}:${m.line} ${m.ruleId}`);
    }
  }
  draft.results['eslint-security'] = { byRule, findings };
  draft.tools.push(`ESLint ${runNode(npxCmd, ['eslint', '--version'], { cwd: lintDir }).out.trim()} + eslint-plugin-security`);
} catch {
  draft.results['eslint-security'] = { notRun: `ESLint output unparseable (exit ${lint.code}): ${lint.err.slice(0, 300)}` };
}

draft.results['image-os-packages'] = { notRun: run('docker', ['version']).error ? 'Docker not available' : 'Docker available - build the image and run trivy image / osv-scanner scan image by hand' };

fs.writeFileSync(path.join(outDir, 'draft-run.json'), JSON.stringify(draft, null, 2));
console.log(JSON.stringify(draft.results, null, 2));
console.log(`\nDraft written to ${path.join(outDir, 'draft-run.json')}`);
console.log('Next: the manual read, then append a run to server/securityReviews/solfascribe-omr.js (see the skill).');
