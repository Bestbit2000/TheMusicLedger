// ML-192: deep ("assisted") security review history for solfascribe-omr - one entry per review,
// newest last. Admin -> Security reads this alongside the automated runs in the database; see
// server/services/securityReview.js and docs/omr-security-review.md.
//
// Written by Claude Code during a review (.claude/skills/omr-security-review). Append a new run -
// never edit an old one: this file IS the audit trail (and git history is its history).
// A module rather than a .json file so Vercel's bundler always traces it into the function.
//
// Per result: checkKey (must match a CHECKS key in securityReview.js), status
// (pass / warn / fail / info / not_run / error), summary, details (plain strings).
// acceptedAdvisories: dependency advisories assessed as not reachable - the automated OSV checks
// report these as accepted instead of new.

export default {
  targetKey: 'solfascribe-omr',
  runs: [
    {
      id: '2026-09-23',
      reviewedAt: '2026-09-23T20:55:00Z',
      reviewer: 'Claude Code (ML-192 session)',
      upstreamCommitSha: 'a6325864c6ef52f33f052475a2510213b72aa711',
      audiveris: { version: '5.10.2', commitSha: '1b7cf44088c68f4168801822a613751d1bb1b584' },
      tools: [
        'Manual read of src/*.ts (1,111 lines), Dockerfile, deploy/, .github/',
        'Gitleaks 8.30.1 (checksum verified)',
        'OSV-Scanner 2.6.0 (checksum verified)',
        'ESLint 9.39.5 + eslint-plugin-security 4.0.1 + typescript-eslint',
        'npm audit (npm 11.19.0)',
        'OSV API (api.osv.dev) for the Audiveris Maven dependencies',
        'fast-xml-parser entity-expansion test against our reader\'s options'
      ],
      verdict: {
        status: 'no-go',
        summary: 'Not yet - keep flow_import_from_file off. The service code is careful, but it has no authentication, so it must not be deployed where the internet can reach it until our deployment adds a check.',
        conditions: [
          { done: false, text: 'Our deployment checks callers: a bearer-token match in our Caddyfile (or Cloudflare Access), with the same token in AUDIVERIS_SERVICE_TOKEN on Vercel. The live probe must pass.' },
          { done: false, text: 'Deploy from a pinned upstream commit (not main), with our compose override: cap_drop ALL, no-new-privileges, pids_limit, a CPU limit, and a network with no internet egress for the engine.' },
          { done: false, text: 'Self-host it. Never point AUDIVERIS_SERVICE_URL at someone else\'s instance (the upstream examples point at the author\'s own app and home machine).' },
          { done: true, text: 'Our side: SSRF in /flows/from-file, missing size caps, .mxl zip bomb, OMR output read as text - fixed on branch ml-192-omr-security-review (needs a release).' },
          { done: false, text: 'Scan the built image (Trivy / OSV-Scanner) once Docker is available, and rebuild it regularly - OS packages are only as fresh as the last build.' }
        ]
      },
      acceptedAdvisories: [
        { id: 'GHSA-25qh-j22f-pwp8', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'needs attacker control of logback configuration - not exposed' },
        { id: 'GHSA-6v67-2wr5-gvf4', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'needs attacker control of logback configuration - not exposed' },
        { id: 'GHSA-jhq6-gfmj-v8fx', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'logback receivers/serialized input not used' },
        { id: 'GHSA-p47f-322f-whfh', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'logback receivers/serialized input not used' },
        { id: 'GHSA-pr98-23f8-jwxv', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'needs attacker control of logback configuration - not exposed' },
        { id: 'GHSA-qqpg-mvqg-649v', package: 'ch.qos.logback:logback-core@1.4.14', reason: 'needs attacker control of logback configuration - not exposed' },
        { id: 'GHSA-gv87-q66h-4277', package: 'com.itextpdf:itextpdf@5.5.13.2', reason: 'iText CompareTool (Ghostscript) - Audiveris only writes PDFs, never compares' },
        { id: 'GHSA-78wr-2p64-hpwj', package: 'commons-io:commons-io@2.4', reason: 'XmlStreamReader on untrusted XML - XML/.omr inputs are refused before the engine' },
        { id: 'GHSA-gwrp-pvrq-jmwv', package: 'commons-io:commons-io@2.4', reason: 'FilenameUtils.normalize - filenames are sanitised by the service' },
        { id: 'GHSA-82fw-gwwq-j7x9', package: '@vitest/mocker, vitest (dev)', reason: 'test-only, not in the image (npm ci --omit=dev)' },
        { id: 'GHSA-67mh-4wv8-2f99', package: 'esbuild (dev)', reason: 'test-only, not in the image' },
        { id: 'GHSA-4w7w-66w2-5vf9', package: 'vite (dev)', reason: 'test-only, not in the image' },
        { id: 'GHSA-fx2h-pf6j-xcff', package: 'vite (dev)', reason: 'test-only, not in the image' },
        { id: 'GHSA-v6wh-96g9-6wx3', package: 'vite (dev)', reason: 'test-only, not in the image' },
        { id: 'GHSA-5xrq-8626-4rwp', package: 'vitest (dev)', reason: 'test-only, not in the image' }
      ],
      results: [
        { checkKey: 'manual-code-read', status: 'pass',
          summary: 'All 4 source files (1,111 lines) read in full. No injection, traversal or deserialisation flaw found; the code is defensive throughout.',
          details: [
            'src/server.ts (199) - 4 routes, multipart limits, fixed-sentence 5xx handler, CORS from env.',
            'src/jobs.ts (405) - UUID job dirs, streaming uploads, queue/live caps (counting uploads still arriving), TTL sweep, engine log sweep.',
            'src/audiveris.ts (375) - spawn without a shell, process-tree kill on timeout/abort, salvage retry capped at 2,000 sheets.',
            'src/inputGuards.ts (132) - extension allowlist + magic bytes, filename sanitiser, path redaction.',
            'fake-audiveris/ and test/ are not copied into the image (Dockerfile copies src/ only).'
          ] },
        { checkKey: 'eslint-security', status: 'pass',
          summary: '17 warnings in src/, all reviewed as false positives (plus 5 in the test shim, which isn\'t shipped).',
          details: [
            'src/: 16 x detect-non-literal-fs-filename - every path is built from a server-generated UUID and a sanitised name, under WORK_ROOT.',
            'src/: 1 x detect-unsafe-regex on WINDOWS_RESERVED_NAME (inputGuards.ts:95) - linear pattern, no nested quantifiers, input is one filename.',
            'fake-audiveris/fake.mjs: 3 x fs rule, 2 x detect-object-injection - test shim, not in the image.',
            'test/: 27 more of the same fs rule (not shipped).'
          ] },
        { checkKey: 'npm-audit', status: 'pass',
          summary: 'No advisories in production dependencies. 7 in dev/test-only packages that never reach the image.',
          details: [
            'npm audit --omit=dev: found 0 vulnerabilities (fastify, @fastify/cors, @fastify/multipart, tsx).',
            'OSV-Scanner over package-lock.json: 178 packages, 7 advisories (1 critical, 1 high, 5 moderate) - all vitest/vite/esbuild/@vitest/mocker, dev only.',
            'The Dockerfile runs npm ci --omit=dev, so none of these are installed in the image. Upstream could still upgrade vitest.'
          ] },
        { checkKey: 'java-dependencies', status: 'warn',
          summary: '9 advisories in Audiveris 5.10.2\'s declared dependencies; none reachable from batch PDF/image conversion. Warn because the engine ships old libraries.',
          details: [
            'logback-core 1.4.14 x6 - config / receiver attacks; the engine\'s logging config isn\'t attacker-controlled.',
            'itextpdf 5.5.13.2 - CVE-2021-43113 is the CompareTool Ghostscript call; Audiveris uses iText only to write PDFs.',
            'commons-io 2.4 (repackaged) - XmlStreamReader DoS and FilenameUtils.normalize traversal; XML/.omr inputs are refused at upload and filenames are sanitised.',
            'PDF parsing is PDFBox 3.0.6 - no known advisories. Tesseract/Leptonica (bytedeco 1.5.12) - none listed.',
            'Transitive Java dependencies were not enumerated (no Gradle lockfile upstream) - covered by the image scan once Docker is available.'
          ] },
        { checkKey: 'image-os-packages', status: 'not_run',
          summary: 'Not run - Docker isn\'t available on the review machine.',
          details: [
            'Image: eclipse-temurin:25-jre (Ubuntu) + apt tesseract-ocr, tesseract-ocr-eng, fontconfig, fonts-dejavu-core, curl + Node 22 from NodeSource.',
            'None of these are pinned, so the image is only as current as its last build - rebuild regularly.',
            'To run: docker build the upstream repo, then trivy image <tag> (or osv-scanner scan image <tag>).'
          ] },
        { checkKey: 'command-injection', status: 'pass',
          summary: 'spawn() is called with an argument array and no shell; nothing user-supplied can become an option or a command.',
          details: [
            'audiveris.ts runProcess: spawn(executable, [...args]) - no shell:true, no exec().',
            'The executable comes from the operator\'s AUDIVERIS_CMD, never the request.',
            'The input path is absolute (<WORK_ROOT>/<uuid>/<name>), and the sanitiser replaces "-" too, so it can\'t be read as a flag.',
            '-sheets values are integers parsed from the engine log, capped at 2,000; OMR_JAVA_MAX_HEAP is validated by regex at boot.'
          ] },
        { checkKey: 'path-traversal', status: 'pass',
          summary: 'Uploads are written under a random UUID directory with a sanitised name; downloads only serve files named in the job\'s own manifest.',
          details: [
            'Upload lands as upload.bin, then is renamed to safeInputFilenameOf(...) - separators, control chars, Windows device names handled.',
            'GET /jobs/:id/files/:name: exact match against the manifest, never joined from the URL (and no double-decoding).',
            'Job ids are Map lookups; the sweepers only touch direct children of WORK_ROOT.'
          ] },
        { checkKey: 'ssrf', status: 'pass',
          summary: 'The service only accepts uploads - it never fetches a URL it was given.',
          details: [
            'No route takes a URL. PDFBox rendering doesn\'t fetch remote resources.',
            'Audiveris .omr project files (which can reference other files) are refused at upload.',
            'Residual: the engine container can reach the internet (see Deployment hardening).'
          ] },
        { checkKey: 'dos-limits', status: 'warn',
          summary: 'Well bounded per job, but one caller can still monopolise the service - and with no authentication, anyone can.',
          details: [
            'In place: 40 MB upload cap, 1 file per request, streamed to disk, queue cap 25, live-job cap 40, concurrency 1, 15-minute timeout with process-tree kill, 60-page cap, 20-minute result TTL, 5-minute request timeout, 10 GB memory limit.',
            'The page cap is approximate: pages in compressed object streams aren\'t counted (upstream says so).',
            'No pixel-dimension cap for PNG/JPEG/TIFF input.',
            'A failed full pass can trigger one salvage re-run, so a job can take up to ~30 minutes.',
            'No rate limiting: 25 queued jobs x up to 30 minutes at concurrency 1 blocks our imports for hours.'
          ] },
        { checkKey: 'unsafe-deserialisation', status: 'pass',
          summary: 'The Java deserialisation surface (.omr books: zip + JAXB unmarshalling) is refused before the engine runs.',
          details: [
            'Only PDF/PNG/JPEG/TIFF with matching magic bytes reach Audiveris.',
            'The classifier model ships inside the image; nothing user-supplied is loaded as a model.',
            'Node side parses only JSON and multipart.'
          ] },
        { checkKey: 'secrets-history', status: 'pass',
          summary: 'Gitleaks found no secrets in the full history (16 commits) or the working tree.',
          details: ['gitleaks git: 16 commits, ~261 KB - no leaks.', 'gitleaks dir: ~142 KB - no leaks.'] },
        { checkKey: 'env-examples', status: 'info',
          summary: 'The example config expects no credentials at all - consistent with the service having no authentication.',
          details: [
            'home.env.example: engine path, CORS origins, concurrency, port, host, heap, tessdata path.',
            'cloudflared-config.example.yml: points at a local tunnel credentials file (kept out of the repo).',
            'deploy/oracle: needs OMR_DOMAIN and CORS_ORIGIN only.'
          ] },
        { checkKey: 'container-hardening', status: 'warn',
          summary: 'Non-root with a memory limit, but none of the kernel-level restrictions are set.',
          details: [
            'Done: USER omr (UID 1000), npm ci --omit=dev, port not published (Caddy only), mem_limit 10g, healthcheck, work dir on a volume swept at boot.',
            'Missing: cap_drop ALL, no-new-privileges, read_only root filesystem, pids_limit, CPU limit, egress restriction (the engine never needs the internet).',
            'These belong in our own compose override - we don\'t change the upstream repo.'
          ] },
        { checkKey: 'service-authentication', status: 'fail',
          summary: 'No authentication anywhere. Blocking: our deployment has to add it before this goes live.',
          details: [
            'No Fastify auth hook; deploy/oracle/Caddyfile is a plain reverse_proxy; the home deployment\'s Cloudflare tunnel has no Access policy.',
            'CORS only restricts browsers - curl, scripts and bots aren\'t affected.',
            'Job ids are random UUIDs, so results can\'t be guessed - but anyone can submit jobs (free compute on our VM) and fill the queue (see Resource exhaustion).',
            'Our AUDIVERIS_SERVICE_TOKEN is sent as a bearer token and currently ignored.',
            'Fix (ours): in our Caddyfile, only proxy requests whose Authorization header equals "Bearer {$OMR_TOKEN}" and answer 401 otherwise (or Cloudflare Access with a service token); set the same token in Vercel.'
          ] },
        { checkKey: 'supply-chain', status: 'warn',
          summary: 'Built from source on the VM, which is good - but several inputs are fetched by moveable tags.',
          details: [
            'FROM eclipse-temurin:25-jdk / 25-jre and caddy:2 by tag, not digest.',
            'git clone --branch 5.10.2: a tag, which can be moved (today it resolves to 1b7cf440).',
            'NodeSource installed with curl | bash (a remote script run as root at build time).',
            'apt packages unpinned.',
            'Good: npm ci honours the lockfile; no third-party registry image is pulled for the service.',
            'Fix: deploy from a pinned upstream commit and pin digests in our deployment.'
          ] },
        { checkKey: 'ci-workflow', status: 'info',
          summary: 'Upstream CI only builds and tests; nothing it produces reaches our deployment.',
          details: [
            'Actions pinned by major tag (actions/checkout@v4, actions/setup-node@v4), not SHA.',
            'No explicit permissions: block (default token permissions); pull_request trigger, no secrets used.',
            'No image is published - we build our own on the VM.'
          ] },
        { checkKey: 'our-client', status: 'warn',
          summary: '5 issues on our side, all fixed on branch ml-192-omr-security-review - not released yet.',
          details: [
            'FIXED (medium) SSRF: /flows/from-file fetched any blobUrl from the request body. Now only this app\'s Blob store, at the uploaded pathname, with redirects refused.',
            'FIXED (medium) No size caps: the Blob upload token had no maximumSizeInBytes and the route read any body in full. Now 40 MB at upload and on read.',
            'FIXED (medium) .mxl zip bomb: an entry was inflated with no size check. Now refused past 20 MB - by the declared size, and by a streaming inflate that stops at the cap (so a forged header cannot get past it).',
            'FIXED (functional) OMR output: the service returns compressed .mxl, but runOmr read it as text - PDF import could never have worked. Now unzipped through the same capped path.',
            'FIXED (low) The OMR job id from the service is now URL-encoded before it goes into request paths.',
            'OK: fast-xml-parser 5.11.1 - no known advisories; entity bombs aren\'t expanded and external entities are refused (tested with our reader\'s options).',
            'OK: only the service\'s short failure detail reaches users, never its log tail.'
          ] },
        { checkKey: 'third-party-instance', status: 'warn',
          summary: 'We must run our own copy. The upstream examples are set up for the author\'s own app and home machine.',
          details: [
            'home.env.example allows https://solfascribe.app and a workers.dev staging origin.',
            'Pointing AUDIVERIS_SERVICE_URL at someone else\'s instance would send our users\' scores (possibly private or copyrighted) to a machine we don\'t control.'
          ] },
        { checkKey: 'agpl-licence', status: 'info',
          summary: 'Wrapper is MIT; the Audiveris engine is AGPL-3.0. Fine to run unmodified as a separate service.',
          details: [
            'Calling it over HTTP doesn\'t make TheMusicLedger AGPL.',
            'If we ever patch Audiveris and expose it over a network, AGPL section 13 requires offering users the modified source - keep it unmodified, or publish the patch.'
          ] },
        { checkKey: 'prior-review-notes', status: 'pass',
          summary: 'Every "security review 2026-09-15" / "review note" item cited in the code is actually implemented. Authentication was never raised in it.',
          details: [
            'Checked: loopback default bind, CORS required in compose, non-root user, queue/live caps counting pending uploads, input allowlist + magic bytes, engine log sweep, process-tree kill, path redaction, delete-after-remove ordering, npm ci lockfile.',
            '15 references across src/, Dockerfile and compose.'
          ] }
      ]
    }
  ]
};
