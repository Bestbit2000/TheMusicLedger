// ML-595: the one Filter on every list - open it, tap a choice (a pill, or a switch for a yes/no), close it.
// barId is the bar's element id (flowLibraryFilterBar, prepareFilterBar, skillsAddFilterBar...). The filters open in a
// pop-up of their own on a page, or in place inside a pick list's pop-up - both are handled here.
import { Page, Locator } from '@playwright/test';

export async function filterBy(page: Page, barId: string, group: string, value: string): Promise<void> {
    await page.locator(`#${barId} [data-filter-open]`).click();
    const choice = page.locator(`button[data-filter-pick="${group}"][data-value="${value}"]:visible, label:has(input[data-filter-pick="${group}"][data-value="${value}"]) .toggle-slider`).first();
    await choice.click();
    const inPlace = page.locator('[data-filter-panel] .btn-submit[data-filter-back]');
    if (await inPlace.count()) await inPlace.click();
    else await page.locator('#flowChoiceCancelBtn').click();
}

export async function clearFilters(page: Page, barId: string): Promise<void> {
    const clear = page.locator(`#${barId} [data-filter-clear]`);
    if (await clear.count()) await clear.click();
}

// The chip for a filter that is on (its x takes it off)
export const filterChip = (page: Page, barId: string, label: string | RegExp): Locator => page.locator(`#${barId} .filter-chip`, { hasText: label });
