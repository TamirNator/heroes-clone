import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S26.0 — seeded MapScene seed label and share helper', () => {
  test('shows seed label and activates share helper for seeded runs', async ({ page }) => {
    await page.goto('/?seed=12345');
    await waitForScene(page, 'MapScene');

    const label = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('seedLabel');
    });
    expect(label).toBe('seed:12345');

    const shareInfo = await page.evaluate(() => {
      const g = (window as any).__game;
      const scene = g.scene.getScene('MapScene');
      const hasShareText = !!scene?.children.list.some((c: any) => c.text === 'Share');
      const shareFnType = scene ? typeof scene.shareSeedUrl : 'undefined';
      let canCallShare = false;
      if (scene && typeof scene.shareSeedUrl === 'function') {
        try {
          scene.shareSeedUrl(scene.registry.get('seedLabel'));
          canCallShare = true;
        } catch {
          canCallShare = false;
        }
      }
      return { hasShareText, shareFnType, canCallShare };
    });

    expect(shareInfo.hasShareText).toBe(true);
    expect(shareInfo.shareFnType).toBe('function');
    expect(shareInfo.canCallShare).toBe(true);
  });
});
