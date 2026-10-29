// ML-246: Admin -> Photo reads. Every piece read from a photo or PDF: how it was rated, what it cost, and -
// once the piece was saved - what had to be changed. At the top, whether the rating is earning its place:
// of the pieces saved, how many had the right number of bars and how many needed no change at all, for
// High, Medium and Low. A read whose file was kept ("Keep this as a test" in Quick entry) is a test case:
// it can be read again with today's prompt and model, and the new read is set beside the first.
// Built from the panel's own pieces (tables, badges, buttons): no classes of its own.
// docs/piece-from-photo.md.
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    let data = null;

    const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const money = (usd) => (usd === null || usd === undefined ? '–' : usd < 0.995 ? `${Math.round(usd * 100)}¢` : `$${usd.toFixed(2)}`);
    const BADGE = { high: 'pass', medium: 'warn', low: 'fail' };
    const badge = (level) => `<span class="admin-badge ${BADGE[level] || 'never'}">${esc(level)}</span>`;
    const many = (n, one, more) => `${n} ${n === 1 ? one : more}`;
    // ML-657: what the member told a read again
    const givensText = (g) => [`${g.beats}/${g.beatType}`, g.changes ? 'changes time' : 'one time throughout', g.pickup ? 'a pickup' : 'no pickup', g.bars ? many(g.bars, 'bar', 'bars') : ''].filter(Boolean).join(', ');

    // What was changed before saving, in a few words
    function changedText(c) {
        if (!c) return '<span class="text-muted">Not compared</span>';
        if (c.same) return 'Nothing';
        const parts = [];
        if (c.bars[0] !== c.bars[1]) parts.push(`bars ${c.bars[0]} → ${c.bars[1]}`);
        if (c.timeBars) parts.push(many(c.timeBars, "bar's time", "bars' time"));
        [['marks', 'mark', 'marks'], ['speeds', 'speed', 'speeds'], ['repeats', 'repeat', 'repeats'], ['signs', 'sign', 'signs'], ['pauses', 'pause', 'pauses']].forEach(([k, one, more]) => {
            const n = Math.max(c[k].missed.length, c[k].extra.length);
            if (n) parts.push(many(n, one, more));
        });
        return esc(parts.join(', '));
    }

    function pieceRows(r) {
        if (r.status !== 'read') return `<tr><td>${esc(when(r.at))}</td><td class="admin-bc-text" colspan="5"><span class="admin-badge fail">Failed</span> ${esc(r.failure || '')}</td><td>–</td><td></td></tr>`;
        return r.pieces.map((p, i) => {
            const reruns = i === 0 ? r.reruns.map(x => `<div class="admin-stat-tile-sub">Read again ${esc(when(x.at))}: ${x.status === 'read' ? (x.pieces || []).map(q => `${q.bars} bars, ${esc(q.rating)}${q.changes ? `, differs: ${changedText(q.changes).toLowerCase()}` : ''}`).join(' · ') : `failed - ${esc(x.failure || '')}`} <span class="text-muted">(${esc(x.promptVersion || '')}, ${money(x.costUsd)})</span></div>`).join('') : '';
            const actions = [
                p.savedAt ? `<button type="button" class="admin-stat-exclude-btn" data-checked="${p.id}" data-on="${p.checkedAt ? '0' : '1'}" aria-pressed="${!!p.checkedAt}">${p.checkedAt ? 'Checked ✓' : 'Mark as checked'}</button>` : '',
                i === 0 && r.isTest ? `<button type="button" class="admin-stat-exclude-btn" data-rerun="${r.id}">Read again</button><button type="button" class="admin-stat-exclude-btn is-danger" data-drop="${r.id}">Stop keeping the file</button>` : ''
            ].join(' ');
            return `<tr>
                <td>${i === 0 ? esc(when(r.at)) : ''}</td>
                <td class="admin-bc-text"><strong>${esc(p.title || `Piece ${p.index + 1}`)}</strong>${i === 0 && r.isTest ? ' <span class="admin-badge info">Test</span>' : ''}<div class="admin-stat-tile-sub">${esc(r.fileKind === 'pdf' ? 'PDF' : many(r.fileCount, 'photo', 'photos'))} · ${esc(r.promptVersion || '')}</div>${i === 0 && r.givens ? `<div class="admin-stat-tile-sub">Told: ${esc(givensText(r.givens))}</div>` : ''}${i === 0 && r.pageWarnings ? `<div class="admin-stat-tile-sub">Read anyway: ${esc(r.pageWarnings.map((w) => `page ${w.page} ${w.kinds.join(', ')}`).join('; '))}</div>` : ''}${reruns}</td>
                <td>${badge(p.rating)}</td>
                <td>${p.bars}${p.savedAt ? ` → ${p.savedBars}` : ''}</td>
                <td class="admin-bc-text">${p.savedAt ? changedText(p.changes) : '<span class="text-muted">Not saved</span>'}</td>
                <td>${i === 0 ? `${r.seconds} s${r.estimateSeconds ? `<div class="admin-stat-tile-sub">estimated ${r.estimateSeconds} s</div>` : ''}${r.stoppedAt ? '<div class="admin-stat-tile-sub">Stopped - while reading</div>' : ''}` : ''}</td>
                <td>${i === 0 ? money(r.costUsd) : ''}</td>
                <td class="admin-bc-text">${actions}</td>
            </tr>`;
        }).join('');
    }

    // ML-645: how often a member stops waiting (the owner, 28 Oct 2026: a stopped read doesn't count against their
    // allowance, so it's measured) - while sending and while reading, how long they had waited, and what it cost
    function stoppedHtml(st) {
        if (!st) return '';
        const line = (label, x) => `<tr><td class="admin-bc-text">${label}</td><td>${x.sending}</td><td>${x.reading}</td><td>${x.waitedSeconds === null ? '–' : `${x.waitedSeconds} s`}</td></tr>`;
        return `
            <h2 class="admin-stat-section-title">Stopped reads</h2>
            <p class="admin-intro">A member can stop waiting. A stop while sending costs nothing; a read stopped while reading may still have been paid for (${money(st.costUsd)} so far) - and neither counts against their allowance.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">When</th><th>While sending</th><th>While reading</th><th>Waited (middle)</th></tr></thead>
                <tbody>${line('This month', st.month)}${line('This quarter', st.quarter)}${line('All', st.all)}</tbody>
            </table></div>`;
    }

    // ML-639: how each kind of check was answered when the piece was saved - a guess that is mostly changed needs work
    function answersHtml(rows) {
        if (!rows || !rows.length) return '';
        return `
            <h2 class="admin-stat-section-title">How the checks were answered</h2>
            <p class="admin-intro">When a piece read from a photo is saved: for each kind of check, how often it was agreed (one by one, or with Agree all), changed, checked, or left open.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Check</th><th>Agreed</th><th>Agree all</th><th>Changed</th><th>Checked</th><th>Left open</th></tr></thead>
                <tbody>${rows.map((r) => `<tr><td class="admin-bc-text">${esc(r.kind)}</td><td>${r.agreed}</td><td>${r.agreedAll}</td><td>${r.changed}</td><td>${r.checked}</td><td>${r.open}</td></tr>`).join('')}</tbody>
            </table></div>`;
    }

    // ML-655: the same answers by the read's level - if High needs as much changing as Medium, the level means little
    function answersByLevelHtml(rows) {
        if (!rows || !rows.some((r) => r.pieces)) return '';
        return `
            <h2 class="admin-stat-section-title">The answers by level</h2>
            <p class="admin-intro">The same answers, for the pieces read at each level. A level whose checks are mostly changed is saying less than it should.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Level</th><th>Pieces</th><th>Agreed</th><th>Agree all</th><th>Changed</th><th>Checked</th><th>Left open</th></tr></thead>
                <tbody>${rows.map((r) => `<tr><td class="admin-bc-text">${badge(r.level)}</td><td data-label="Pieces">${r.pieces}</td><td data-label="Agreed">${r.agreed}</td><td data-label="Agree all">${r.agreedAll}</td><td data-label="Changed">${r.changed}</td><td data-label="Checked">${r.checked}</td><td data-label="Left open">${r.open}</td></tr>`).join('')}</tbody>
            </table></div>`;
    }

    // ML-657 part 3: the quick look at the pages - does it earn its few seconds? How often it stopped a read and for
    // what, what people did, whether reads it was right to stop (read anyway) came back with page problems, and how
    // often a read it passed still found one (its misses)
    const LOOK_KINDS = { notMusic: 'not music', unreadable: 'hard to read', missing: 'a page missing' }; // (an edge cut off and no end are only noted - the owner, 29 Oct 2026)
    function pageChecksHtml(c) {
        if (!c || !c.checks) return '';
        const kinds = Object.entries(c.byKind).map(([k, n]) => `${esc(LOOK_KINDS[k] || k)} ${n}`).join(', ');
        return `<h2 class="admin-stat-section-title">The quick look at the pages</h2>
            <p class="admin-intro">${many(c.checks, 'look', 'looks')}${c.failed ? ` (${c.failed} failed - the read carried on)` : ''} with <strong>${esc(c.model)}</strong>, about ${c.seconds} seconds and ${money(c.costPerCheck)} each (${money(c.costUsd)} in all). It stopped ${many(c.stopped, 'read', 'reads')}${kinds ? ` (${kinds})` : ''}: ${c.choices['read anyway']} read anyway, ${c.choices.retake} retaken, ${c.choices.stopped} left there. Of those read anyway, ${c.readAnywayFoundProblem} of ${c.readAnywayRead} came back with a page problem. Of the reads it let through, ${c.missed} of ${c.passedRead} still found one (its misses). It turned ${many(c.turned, 'read', 'reads')}' pages upright and couldn't read the time signature on ${c.timeNotRead}.</p>`;
    }

    function render() {
        const s = data.summary;
        const ratingRows = s.byRating.map(r => `<tr><td class="admin-bc-text">${badge(r.level)}</td><td>${r.saved}</td><td>${r.saved ? `${r.barsRight} of ${r.saved}` : '–'}</td><td>${r.saved ? `${r.same} of ${r.saved}` : '–'}</td></tr>`).join('');
        $('adminPieceReads').innerHTML = `
            <p class="admin-intro">${many(s.reads, 'read', 'reads')}${s.failed ? ` (${s.failed} failed)` : ''}, ${many(s.pieces, 'piece', 'pieces')} found, ${s.saved} saved, ${many(s.tests, 'test kept', 'tests kept')}. ${s.costPerRead === null ? '' : `About ${money(s.costPerRead)} and ${s.seconds} seconds a read; ${money(s.costUsd)} in all at the model's list price - Vercel's AI Gateway page is the bill.`} Reading now with <strong>${esc(data.model)}</strong>, prompt <strong>${esc(data.promptVersion)}</strong>.</p>
            ${stoppedHtml(s.stopped)}
            ${pageChecksHtml(data.pageChecks)}
            ${answersHtml(s.answers)}
            ${answersByLevelHtml(s.answersByLevel)}
            <h2 class="admin-stat-section-title">Is the rating right?</h2>
            <p class="admin-intro">Of the pieces saved after a read: how many had the right number of bars, and how many were saved with nothing changed. If High is no better than Medium, the rating needs work.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Rating</th><th>Saved</th><th>Bars right</th><th>Nothing changed</th></tr></thead>
                <tbody>${ratingRows}</tbody>
            </table></div>
            <h2 class="admin-stat-section-title">Every read</h2>
            <p class="admin-intro">Newest first. "Changed" is what differed between what was read and the piece as saved - the saved piece is taken as right, so mark it as checked once you have looked at the page. A test can be read again: that costs about the same as the first read.</p>
            ${data.reads.length ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th>When</th><th class="admin-bc-text">Piece</th><th>Rating</th><th>Bars</th><th class="admin-bc-text">Changed</th><th>Took</th><th>Cost</th><th class="admin-bc-text"></th></tr></thead>
                <tbody>${data.reads.map(pieceRows).join('')}</tbody>
            </table></div>` : '<p class="admin-intro">Nothing has been read yet. Add a piece → From a photo or PDF.</p>'}
            <span class="admin-test-case-meta" id="pieceReadsStatus" role="status" aria-live="polite"></span>`;
    }

    async function open() {
        try { data = await A.apiCall('/api/admin/piece-reads'); render(); } catch (error) { $('adminPieceReads').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    async function act(call, done) {
        try { data = await call(); render(); if (done) A.showToast(done, 'success'); } catch (error) { A.showToast(error.message); render(); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminPieceReads');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="piece-reads"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !data) return;
            if (t.dataset.checked) act(() => A.apiCall(`/api/admin/piece-reads/pieces/${t.dataset.checked}/checked`, 'PUT', { on: t.dataset.on === '1' }));
            if (t.dataset.rerun) {
                A.showConfirmModal('Read it again?', 'The kept file is read with the prompt and model in use now. It takes up to a minute and costs about the same as the first read. The first read is kept as it is.', () => {
                    t.disabled = true;
                    t.textContent = 'Reading...';
                    act(() => A.apiCall(`/api/admin/piece-reads/${t.dataset.rerun}/rerun`, 'POST'), 'Read again');
                }, false);
            }
            if (t.dataset.drop) {
                A.showConfirmModal('Stop keeping the file?', 'The photo or PDF is deleted from the file store. The read stays in this list, but it can no longer be read again.', () => {
                    act(() => A.apiCall(`/api/admin/piece-reads/${t.dataset.drop}/test-files`, 'DELETE'), 'File deleted');
                }, true);
            }
        });
    });
})();
