import { test, expect } from '@playwright/test';

test.describe('S4.0 — encounter trigger', () => {
  test('walking onto enemy hex transitions to CombatScene, return goes back to MapScene', async ({ page }) => {
    await page.goto('/?nointro');

    // Wait for the canvas to mount and Phaser to boot
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Wait until MapScene is the active scene
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      if (!g) return false;
      const scenes = g.scene.getScenes(true); // active scenes only
      return scenes.some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    // Take initial screenshot for the artifact log
    await page.screenshot({ path: 'test-results/s4-0-initial.png' });

    // Teleport hero to the hex adjacent to the enemy (one step away) so the
    // encounter can be triggered in a single click within the movement budget.
    // TypeScript `private` is compile-time only — all fields are accessible at runtime.
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const targetCol = 4;
      const targetRow = 3; // one row above enemy at (4,4)
      map.heroCol = targetCol;
      map.heroRow = targetRow;
      const x = map.startX + targetCol * map.colStep + (targetRow % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + targetRow * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Read enemy hex pixel coords from the game
    const enemyPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map: any = g.scene.getScene('MapScene');
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

    // Click the enemy hex
    await page.mouse.click(enemyPos.x, enemyPos.y);

    // Wait for CombatScene to become active (allow generous time for animation)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const scenes = g.scene.getScenes(true);
      return scenes.some((s: any) => s.scene.key === 'CombatScene');
    }, { timeout: 10000 });

    await page.screenshot({ path: 'test-results/s4-0-combat.png' });

    // The Return button is a Phaser Rectangle in CombatScene.
    const returnPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat: any = g.scene.getScene('CombatScene');
      const rects = combat.children.list.filter((c: any) => c.type === 'Rectangle');
      const btn = rects[0]; // Return button is added first (y=50); Attack button is second (y=530)
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

    // Wait for MapScene to be active again
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const scenes = g.scene.getScenes(true);
      return scenes.some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s4-0-back-to-map.png' });
  });
});
