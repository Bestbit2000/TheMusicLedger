// ML-192: the pure rule helpers behind Admin -> Security's automated checks, plus the shape of the
// deep-review history file (every result must hang off a check the page knows about).

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const {
  CHECKS, SECTIONS, lockfilePackages, gradleDependencies, containerHardeningRules, supplyChainRules, serviceAuthRules, assistedRuns
} = await import('../services/securityReview.js');

// Trimmed from the real upstream files at a6325864 (the first deep review).
const DOCKERFILE = `FROM eclipse-temurin:25-jdk AS audiveris-build
ARG AUDIVERIS_VERSION=5.10.2
RUN git clone --depth 1 --branch \${AUDIVERIS_VERSION} https://github.com/Audiveris/audiveris.git /build
FROM eclipse-temurin:25-jre
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y --no-install-recommends nodejs
RUN npm ci --omit=dev
USER omr
`;
const COMPOSE = `services:
  omr:
    build: ../..
    mem_limit: 10g
    expose:
      - "8480"

  caddy:
    image: caddy:2
    ports:
      - "80:80"
`;

test('container rules: non-root and memory limit pass, kernel restrictions flagged', () => {
  const byRule = Object.fromEntries(containerHardeningRules(DOCKERFILE, COMPOSE).map((r) => [r.rule, r]));
  assert.equal(byRule['Runs as a non-root user'].ok, true);
  assert.equal(byRule['Memory limit set'].ok, true);
  assert.equal(byRule['Service port not published on the host'].ok, true, 'caddy\'s ports must not count against omr');
  for (const rule of ['All Linux capabilities dropped', 'no-new-privileges', 'Read-only root filesystem', 'Process count limit', 'CPU limit set']) {
    assert.equal(byRule[rule].ok, false, rule);
  }
  const hardened = COMPOSE.replace('mem_limit: 10g', 'mem_limit: 10g\n    cpus: 2\n    pids_limit: 256\n    read_only: true\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL');
  const again = Object.fromEntries(containerHardeningRules(DOCKERFILE, hardened).map((r) => [r.rule, r.ok]));
  assert.equal(again['All Linux capabilities dropped'] && again['no-new-privileges'] && again['Read-only root filesystem'] && again['Process count limit'] && again['CPU limit set'], true);
});

test('supply chain rules flag tag-only images, curl | bash and a tag clone', () => {
  const byRule = Object.fromEntries(supplyChainRules(DOCKERFILE).map((r) => [r.rule, r.ok]));
  assert.deepEqual(byRule, {
    'Base images pinned by digest': false,
    'No curl | bash installs': false,
    'Audiveris source pinned to a commit': false,
    'npm install honours the lockfile': true,
    'Dev dependencies left out of the image': true
  });
});

test('auth rules: plain reverse_proxy and no hook = no auth; a header match or hook counts', () => {
  assert.deepEqual(serviceAuthRules('server.register(cors)', '{$OMR_DOMAIN} {\n\treverse_proxy omr:8480\n}'), { codeAuth: false, proxyAuth: false });
  assert.equal(serviceAuthRules('', '@ok header Authorization "Bearer {$OMR_TOKEN}"\nreverse_proxy @ok omr:8480').proxyAuth, true);
  assert.equal(serviceAuthRules("server.addHook('onRequest', async (req) => { if (req.headers.authorization !== t) throw 401 })", '').codeAuth, true);
});

test('lockfilePackages reads names (scoped too) and dev flags', () => {
  const pkgs = lockfilePackages({ packages: {
    '': { name: 'root' },
    'node_modules/fastify': { version: '5.1.0' },
    'node_modules/@fastify/cors': { version: '10.0.1' },
    'node_modules/vite/node_modules/esbuild': { version: '0.21.5', dev: true }
  } });
  assert.deepEqual(pkgs, [
    { name: 'fastify', version: '5.1.0', dev: false },
    { name: '@fastify/cors', version: '10.0.1', dev: false },
    { name: 'esbuild', version: '0.21.5', dev: true }
  ]);
});

test('gradleDependencies resolves ext versions and adds the aliased artifacts OSV knows', () => {
  const gradle = `ext.jcppVersion = '1.5.12'
ext.tessVersion = '5.5.1'
plugins { id 'io.github.jwharm.flatpak-gradle-generator' version '1.7.0' }
dependencies {
  implementation(
    'ch.qos.logback:logback-classic:1.4.14',
    'org.apache.directory.studio:org.apache.commons.io:2.4',
    "org.bytedeco:tesseract:\${tessVersion}-\${jcppVersion}",
  )
  runtimeOnly("org.bytedeco:tesseract:\${tessVersion}-\${jcppVersion}:linux-arm64")
}`;
  const deps = Object.fromEntries(gradleDependencies(gradle).map((d) => [d.name, d.version]));
  assert.equal(deps['ch.qos.logback:logback-core'], '1.4.14');
  assert.equal(deps['commons-io:commons-io'], '2.4');
  assert.equal(deps['org.bytedeco:tesseract'], '5.5.1-1.5.12');
});

test('deep-review history only uses known check keys and statuses', () => {
  const keys = new Set(CHECKS.map((c) => c.key));
  const sections = new Set(SECTIONS.map((s) => s.key));
  for (const c of CHECKS) assert.ok(sections.has(c.section), c.key);
  const runs = assistedRuns();
  assert.ok(runs.length >= 1);
  for (const run of runs) {
    assert.match(run.upstreamCommitSha, /^[0-9a-f]{40}$/);
    assert.ok(['go', 'no-go', 'conditional'].includes(run.verdict.status));
    for (const r of run.results) {
      assert.ok(keys.has(r.checkKey), `unknown check ${r.checkKey}`);
      assert.ok(!r.checkKey.startsWith('auto.'), 'automated checks are recorded by Run now, not the history file');
      assert.ok(['pass', 'warn', 'fail', 'info', 'not_run', 'error'].includes(r.status), r.checkKey);
    }
  }
});
