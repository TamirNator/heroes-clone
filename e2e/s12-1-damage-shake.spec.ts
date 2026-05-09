import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S12.1 — damage shake on hit', () => {
  test('enemy sprite shakes on hit and returns to original position', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport hero adjacent to Goblin at (4,4)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 4;
      map.heroRow = 3;
      const x = map.startX + 4 * map.colStep + (3 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 3 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click the Goblin hex to trigger combat
    const goblinPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const sprite = map.liveEnemies.find((e: any) => e.col === 4 && e.row === 4)?.sprite;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + sprite.x * (rect.width / g.config.width),
        y: rect.top + sprite.y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(goblinPos.x, goblinPos.y);
    await waitForScene(page, 'CombatScene');

    // Pin hero damage to 1 so Goblin (HP 3) survives the hit
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 1;
    });

    // Read enemy sprite's initial x position
    const initialEnemyX = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemySprite.x as number;
    });

    // Compute Attack button viewport coords
    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 320 * (rect.width / g.config.width),
        y: rect.top + 530 * (rect.height / g.config.height),
      };
    });

    // Click Attack
    await page.mouse.click(attackPos.x, attackPos.y);

    // Wait for the enemy sprite to move from its initial position (shake started)
    // The shake begins at ~100ms when the hero lunge peaks and damage is applied.
    await page.waitForFunction((initX: number) => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return Math.abs(combat.enemySprite.x - initX) > 2;
    }, initialEnemyX, { timeout: 1000 });

    // Take screenshot mid-shake
    await page.screenshot({ path: 'test-results/s12-1-mid-shake.png' });

    // Wait for the full combat animation (hero lunge + shake + enemy retaliation lunge + return) to settle.
    // After all tweens complete, enemy sprite returns to its original x.
    await page.waitForFunction((initX: number) => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.isCombatAnimating === false && Math.abs(combat.enemySprite.x - initX) < 1;
    }, initialEnemyX, { timeout: 3000 });

    const finalEnemyX = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemySprite.x as number;
    });
    expect(finalEnemyX).toBeCloseTo(initialEnemyX, 0);

    // Verify enemy HP dropped (damage applied at peak)
    const enemyHp = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp as number;
    });
    expect(enemyHp).toBeLessThan(3); // Goblin starts at 3
  });
});
