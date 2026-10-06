// ML-210 / ML-213: axe-core scan of the main screens in both themes (WCAG 2.2 AA). Complements the
// static checks in scripts/a11y-audit.mjs - axe sees the real rendered page: computed contrast,
// roles/names after JS has run, and target size. Run as part of the dev -> sandbox release:
//
//   npm run a11y-scan        (starts/reuses the local server on the dev branch, dev-login bypass)
//
// Unlike tests/generated/ (materialized from Neon), this spec is committed.
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsLocalDev } from '../helpers/auth';

const SCREENS: { view: string; name: string }[] = [
    { view: 'mainView', name: 'Home' },
    { view: 'quickPlayView', name: 'Metronome' },
    { view: 'statsHomeView', name: 'Stats' }, // ML-327 (the dashboard)
    { view: 'toolResultsView', name: 'Tool results' }, // ML-327
    { view: 'accountDetailsView', name: 'My details' }, // ML-330
    { view: 'historyView', name: 'Session history' },
    { view: 'statsView', name: 'Detailed stats' },
    { view: 'streakStatsView', name: 'Streaks' },
    { view: 'metroBuilderView', name: 'My music' }, // ML-299 (was Flow)
    { view: 'rehearseView', name: 'Rehearse' }, // ML-299
    { view: 'tapTempoView', name: 'Tempo' }, // ML-298
    { view: 'gapTrainerView', name: 'Pulse' }, // ML-295
    { view: 'earView', name: 'Pitch' }, // ML-296
    { view: 'manageChallengesView', name: 'Manage challenges' },
    { view: 'timerView', name: 'Timer' },
    { view: 'accountView', name: 'My account' },
    { view: 'settingsView', name: 'Settings' },
    { view: 'settingsStatsView', name: 'Stats settings' },
    { view: 'settingsTunerView', name: 'Tuner settings' },
    { view: 'settingsDisplayView', name: 'Display and reading' }, // ML-356 / ML-359
    { view: 'aboutView', name: 'About' },
    { view: 'scalesView', name: 'Scales' }, // ML-9
    { view: 'warmupsView', name: 'Warm-ups' }, // ML-294
    { view: 'theoryView', name: 'Theory' }, // ML-260 (Intervals and Chords with theory_grades on, ML-325)
    { view: 'rangeView', name: 'Range' }, // ML-305 (range_trainer)
    { view: 'rhythmView', name: 'Rhythm' }, // ML-306 (rhythm_trainer)
    { view: 'toolsView', name: 'All tools' }, // ML-378
    { view: 'addPieceView', name: 'Add a piece' }, // ML-400
    { view: 'skillsHubView', name: 'Skills' }, // ML-406
    { view: 'prepareListView', name: 'Prepare' }, // ML-401
    { view: 'inviteView', name: 'Invite someone' }, // ML-402
    { view: 'accountBandsView', name: 'My bands' }, // ML-473 (invitations waiting, what you can do in each band)
];

async function show(page: Page, view: string, dark: boolean) {
    await page.evaluate(({ view, dark }) => {
        document.body.classList.toggle('dark-mode', dark);
        (window as any).switchView(view);
    }, { view, dark });
    await page.waitForTimeout(400);
}

for (const dark of [false, true]) {
    test.describe(`${dark ? 'dark' : 'light'} mode`, () => {
        test.beforeEach(async ({ page }) => { await loginAsLocalDev(page); });
        for (const s of SCREENS) {
            test(`${s.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
                await show(page, s.view, dark);
                const results = await new AxeBuilder({ page })
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
                    .analyze();
                const summary = results.violations.map(v => `${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} node(s): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
                expect(summary, summary.join('\n')).toEqual([]);
            });
        }
    });
}
