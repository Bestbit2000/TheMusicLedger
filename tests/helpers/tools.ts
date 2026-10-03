// ML-378: Home shows only your favourite tools (up to the home_tools limit for your account type), so a
// spec can't count on a tool being there. Every tool that's switched on is on the All tools page, so
// specs open a tool the way anyone can reach it: Home -> All tools -> its tile. Call it from Home.
// ML-406: Pitch, Tempo, Pulse and Rhythm open from the Skills tile's list.
import { Page, expect } from '@playwright/test';

const SKILLS = ['Pitch', 'Tempo', 'Pulse', 'Rhythm'];

export async function openTool(page: Page, name: string) {
  await page.getByRole('button', { name: /^All tools/ }).click();
  await expect(page.locator('#toolsView')).toBeVisible();
  if (!SKILLS.includes(name)) { await page.locator('#toolsView').getByRole('button', { name, exact: true }).click(); return; }
  await page.locator('#toolsView').getByRole('button', { name: 'Skills', exact: true }).click();
  await expect(page.locator('#skillsHubView')).toBeVisible();
  await page.locator('#skillsHubList').getByRole('button', { name: new RegExp(`^${name}`) }).click();
}
