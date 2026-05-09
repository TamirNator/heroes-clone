import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S16.1 — title scene', () => {
  test('plain root URL shows TitleScene; ?nointro skips to MapScene', async ({ page }) => {
    // Plain URL — should land on TitleScene
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'TitleScene');

    const titleVisible = await page.evaluate(() => {
      const g = (window as any).__game;
      const title = g.scene.getScene('TitleScene') as any;
      return title.children.list.some((c: any) => c.type === 'Text' && c.text === 'HEROES CLONE');
    });
    expect(titleVisible).toBe(true);

    // ?nointro should skip
    await page.goto('/?nointro');
    await waitForScene(page, 'MapScene');
  });

  test('clicking New Game on TitleScene transitions to MapScene', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'TitleScene');

    // Find New Game button (it's the first button if no save exists, at y=400)
    const newGamePos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 640 * (rect.width / g.config.width),
        y: rect.top + 400 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(newGamePos.x, newGamePos.y);

    await waitForScene(page, 'MapScene');
  });
});
