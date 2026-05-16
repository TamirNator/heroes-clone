import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S25.2 — ?seed URL spawns deterministic map', () => {
  test('two loads with same seed produce identical terrain', async ({ page }) => {
    await page.goto('/?seed=12345');
    await waitForScene(page, 'MapScene');

    const terrainA = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });
    const labelA = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('seedLabel');
    });
    expect(labelA).toBe('seed:12345');

    await page.goto('/?seed=12345');
    await waitForScene(page, 'MapScene');

    const terrainB = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });
    expect(terrainB).toBe(terrainA);
  });

  test('different seeds produce different terrain', async ({ page }) => {
    await page.goto('/?seed=12345');
    await waitForScene(page, 'MapScene');
    const terrainA = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });

    await page.goto('/?seed=99999');
    await waitForScene(page, 'MapScene');
    const terrainB = await page.evaluate(() => {
      const g = (window as any).__game;
      return JSON.stringify(g.registry.get('randomTerrain'));
    });

    expect(terrainB).not.toBe(terrainA);
  });
});
