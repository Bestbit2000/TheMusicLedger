// ML-378: Home shows only your favourite tools (up to the home_tools limit for your account type), so a
// spec can't count on a tool being there. Every tool that's switched on is on the All tools page, so
// specs open a tool the way anyone can reach it: Home -> All tools -> its tile. Call it from Home.
import { Page, expect } from '@playwright/test';

export async function openTool(page: Page, name: string) {
  await page.getByRole('button', { name: /^All tools/ }).click();
  await expect(page.locator('#toolsView')).toBeVisible();
  await page.locator('#toolsView').getByRole('button', { name, exact: true }).click();
}
