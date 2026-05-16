import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S25.1 — seeded RNG + daily challenge', () => {
  test('clicking Daily produces the same terrain twice for the same day', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'TitleScene');

    // First Daily run (button at ~y=540: third in {New Game, Random Game, Daily})
    // Layout when no save: 400 New Game, 470 Random, 540 Daily.
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 640, y: 540 } });
    await waitForScene(page, 'MapScene');

    const terrainA = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });
    const enemiesA = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomEnemySpawns'));
    });

    // Go back to TitleScene and click Daily again
    await page.goto('/');
    await waitForScene(page, 'TitleScene');
    await canvas.click({ position: { x: 640, y: 540 } });
    await waitForScene(page, 'MapScene');

    const terrainB = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });
    const enemiesB = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomEnemySpawns'));
    });

    expect(terrainB).toBe(terrainA);
    expect(enemiesB).toBe(enemiesA);
  });
});
