import { test, expect } from '@playwright/test';

test.describe('S4.1 — defeat outcome', () => {
  test('enemy removed and hero placed at enemy hex after Return from CombatScene', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      if (!g) return false;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s4-1-initial.png' });

    // Verify enemy at (4,4) exists at start
    const enemyExistsInitially = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.liveEnemies.some((e: any) => e.col === 4 && e.row === 4);
    });
    expect(enemyExistsInitially).toBe(true);

    // Teleport hero adjacent to enemy (4,3) — same trick as S4.0 test
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const targetCol = 4;
      const targetRow = 3;
      map.heroCol = targetCol;
      map.heroRow = targetRow;
      const x = map.startX + targetCol * map.colStep + (targetRow % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + targetRow * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click the enemy hex
    const enemyPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const sprite = map.liveEnemies.find((e: any) => e.col === 4 && e.row === 4)?.sprite;
      const canvas: HTMLCanvasElement = g.canvas;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return {
        x: rect.left + sprite.x * scaleX,
        y: rect.top + sprite.y * scaleY,
      };
    });

    await page.mouse.click(enemyPos.x, enemyPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene');
    }, { timeout: 10000 });

    // Click Return button (added first, so rects[0])
    const returnPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat: any = g.scene.getScene('CombatScene');
      const btn = combat.children.list.filter((c: any) => c.type === 'Rectangle')[0];
      const canvas: HTMLCanvasElement = g.canvas;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return {
        x: rect.left + btn.x * scaleX,
        y: rect.top + btn.y * scaleY,
      };
    });

    await page.mouse.click(returnPos.x, returnPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s4-1-after-return.png' });

    // Enemy at (4,4) must be gone; 2 others remain
    const afterState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        enemyGone: !map.liveEnemies.some((e: any) => e.data.col === 4 && e.data.row === 4),
        remainingCount: map.liveEnemies.length,
      };
    });
    expect(afterState.enemyGone).toBe(true);
    expect(afterState.remainingCount).toBe(4);

    // Hero must be at hex (4,4)
    const heroPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { col: map.heroCol, row: map.heroRow };
    });
    expect(heroPos.col).toBe(4);
    expect(heroPos.row).toBe(4);
  });
});
