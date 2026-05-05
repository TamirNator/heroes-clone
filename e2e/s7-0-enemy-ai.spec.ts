import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function waitForNotAnimating(page: any, timeout = 10000) {
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const map = g?.scene.getScene('MapScene') as any;
    if (!map) return false;
    return map.isAnimating === false;
  }, null, { timeout });
}

async function clickEndTurn(page: any) {
  // End Turn button center is at game coords (1200, 68); canvas at 1:1 scaling
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 1200, y: 68 } });
}

test.describe('S7.0 — enemy AI movement on End Turn', () => {
  test('enemy moves one step toward hero after End Turn', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    // Read initial Goblin position — should be spawn at (4,4)
    const initialPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const goblin = map.liveEnemies.find((e: any) => e.data.col === 4 && e.data.row === 4);
      return goblin ? { col: goblin.col as number, row: goblin.row as number } : null;
    });

    expect(initialPos).not.toBeNull();
    expect(initialPos!.col).toBe(4);
    expect(initialPos!.row).toBe(4);

    await clickEndTurn(page);
    await waitForNotAnimating(page);

    await page.screenshot({ path: 'test-results/s7-0-after-one-turn.png' });

    // Goblin should have moved — no longer at (4,4)
    const afterPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const goblin = map.liveEnemies.find((e: any) => e.data.col === 4 && e.data.row === 4);
      return goblin ? { col: goblin.col as number, row: goblin.row as number } : null;
    });

    expect(afterPos).not.toBeNull();
    expect(afterPos!.col === 4 && afterPos!.row === 4).toBe(false);
  });

  test('enemy reaches hero after enough turns and triggers combat', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    // Press End Turn up to 10 times, waiting between each for animations to finish
    // Goblin at (4,4) BFS-approaches hero at (0,0) — should arrive in < 10 turns
    for (let i = 0; i < 10; i++) {
      const combatAlready = await page.evaluate(() => {
        const g = (window as any).__game;
        return g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene');
      });
      if (combatAlready) break;

      await clickEndTurn(page);

      // Wait for either isAnimating === false (turn finished) or CombatScene appears
      await page.waitForFunction(() => {
        const g = (window as any).__game;
        if (g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene')) return true;
        const map = g.scene.getScene('MapScene') as any;
        return map && map.isAnimating === false;
      }, null, { timeout: 10000 });
    }

    await page.screenshot({ path: 'test-results/s7-0-combat-from-enemy-attack.png' });

    const combatActive = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene');
    });
    expect(combatActive).toBe(true);
  });
});
