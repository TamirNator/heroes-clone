import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S10.1 — readability: hero damage label + enemy tooltip', () => {
  test('hero damage label shows current level damage range', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    const dmgLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const texts: string[] = map.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.find(t => /^DMG:/.test(t)) ?? '';
    });

    expect(dmgLabel).toMatch(/^DMG: \d+-\d+$/);
    expect(dmgLabel).toBe('DMG: 1-3');
  });

  test('hovering enemy hex shows tooltip; moving away destroys it', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Get Goblin sprite screen position
    const goblinScreenPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const goblin = map.liveEnemies.find((e: any) => e.data.name === 'Goblin');
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + goblin.sprite.x * (rect.width / g.config.width),
        y: rect.top + goblin.sprite.y * (rect.height / g.config.height),
      };
    });

    // Hover over Goblin hex
    await page.mouse.move(goblinScreenPos.x, goblinScreenPos.y);
    await page.waitForTimeout(200);

    await page.screenshot({ path: 'test-results/s10-1-with-tooltip.png' });

    // Verify tooltip Container exists at depth 200
    const tooltipInfo = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const container = map.children.list.find((c: any) => c.type === 'Container' && c.depth === 200);
      if (!container) return null;
      const texts: string[] = container.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return { texts };
    });

    expect(tooltipInfo).not.toBeNull();
    const texts = tooltipInfo!.texts;
    expect(texts.some(t => t === 'Goblin')).toBe(true);
    expect(texts.some(t => t.startsWith('HP:'))).toBe(true);
    expect(texts.some(t => t.startsWith('DMG:'))).toBe(true);

    // Move mouse to a non-enemy hex (top-left corner)
    await page.mouse.move(100, 100);
    await page.waitForTimeout(200);

    // Tooltip should be destroyed
    const tooltipGone = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return !map.children.list.some((c: any) => c.type === 'Container' && c.depth === 200);
    });

    expect(tooltipGone).toBe(true);
  });
});
