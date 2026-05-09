import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S18.2 — random map generator', () => {
  test('Random Game button generates terrain different from default', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'TitleScene');

    // Click "Random Game" — third button down at y = 540 (no save → 400 New Game, 470 Random Game, 540 About)
    // With save absent: buttons at 400 (New Game), 470 (Random Game), 540 (About)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 640, y: 470 } });

    await waitForScene(page, 'MapScene');

    const random = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('randomTerrain') as Record<string, string> | undefined;
    });
    expect(random).toBeDefined();
    expect(Object.keys(random!).length).toBeGreaterThan(10); // 6-10 water + 8-13 forest

    // Verify hero spawn (0,0) is grass
    const heroTerrain = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.terrainAt(0, 0) as string;
    });
    expect(heroTerrain).toBe('grass');

    // Verify Goblin spawn (4,4) is grass
    const goblinTerrain = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.terrainAt(4, 4) as string;
    });
    expect(goblinTerrain).toBe('grass');
  });

  test('New Game button does NOT set randomTerrain', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'TitleScene');

    // Click "New Game" at y = 400 (no save case)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 640, y: 400 } });

    await waitForScene(page, 'MapScene');

    const random = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('randomTerrain');
    });
    expect(random).toBeUndefined();
  });
});
