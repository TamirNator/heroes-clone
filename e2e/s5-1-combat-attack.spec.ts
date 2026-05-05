import { test, expect } from '@playwright/test';

test.describe('S5.1 — combat attack loop', () => {
  test('3 attacks defeat enemy, VICTORY shown, returns to map with enemy gone', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      if (!g) return false;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    // Teleport hero adjacent to enemy
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

    // Click enemy hex
    const enemyPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const sprite = map.enemySprite;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + sprite.x * scaleX, y: rect.top + sprite.y * scaleY };
    });

    await page.mouse.click(enemyPos.x, enemyPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene');
    }, { timeout: 10000 });

    // Compute Attack button viewport coords (game coords 320, 530)
    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + 320 * scaleX, y: rect.top + 530 * scaleY };
    });

    // Round 1: hero hits enemy 5→3, enemy retaliates hero 10→9
    await page.mouse.click(attackPos.x, attackPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'HP: 3');
    }, { timeout: 3000 });

    await page.screenshot({ path: 'test-results/s5-1-mid-combat.png' });

    const afterRound1 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return { enemyHp3: texts.some(t => t === 'HP: 3') };
    });
    expect(afterRound1.enemyHp3).toBe(true);

    // Wait for retaliation to complete before next click
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'HP: 9');
    }, { timeout: 2000 });

    // Round 2: hero hits enemy 3→1, enemy retaliates hero 9→8
    await page.mouse.click(attackPos.x, attackPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'HP: 1');
    }, { timeout: 3000 });

    // Wait for retaliation
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'HP: 8');
    }, { timeout: 2000 });

    // Round 3: hero hits enemy 1→0 → VICTORY, no retaliation
    await page.mouse.click(attackPos.x, attackPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'VICTORY!');
    }, { timeout: 3000 });

    await page.screenshot({ path: 'test-results/s5-1-victory.png' });

    // Wait for 1500ms timer + scene transition
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s5-1-after-return.png' });

    // Enemy gone, hero at (4,4)
    const mapState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { enemyGone: map.enemySprite === undefined, col: map.heroCol, row: map.heroRow };
    });

    expect(mapState.enemyGone).toBe(true);
    expect(mapState.col).toBe(4);
    expect(mapState.row).toBe(4);
  });
});
