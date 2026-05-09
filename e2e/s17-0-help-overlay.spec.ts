import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S17.0 — in-game help overlay', () => {
  test('pressing H toggles the help overlay on MapScene', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Click canvas to give it keyboard focus
    await page.locator('canvas').click({ position: { x: 640, y: 360 } });

    // Press H
    await page.keyboard.press('H');

    const overlayExists = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.helpOverlay !== undefined;
    });
    expect(overlayExists).toBe(true);

    // Press H again to close
    await page.keyboard.press('H');
    const overlayClosed = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.helpOverlay === undefined;
    });
    expect(overlayClosed).toBe(true);
  });
});
