import { test, expect } from '@playwright/test';

async function teleportHero(page: any, col: number, row: number) {
  await page.evaluate(({ col, row }: { col: number; row: number }) => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    map.heroCol = col;
    map.heroRow = row;
    const x = map.startX + col * map.colStep + (row % 2 === 1 ? map.colStep / 2 : 0);
    const y = map.startY + row * map.rowStep;
    map.heroSprite.setPosition(x, y);
    map.remainingMoves = 5;
  }, { col, row });
}

async function getEnemyViewportPos(page: any, key: string) {
  return page.evaluate((key: string) => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const [col, row] = key.split(',').map(Number);
    const le = map.liveEnemies.find((e: any) => e.col === col && e.row === row);
    const sprite = le?.sprite;
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + sprite.x * scaleX, y: rect.top + sprite.y * scaleY };
  }, key);
}

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((key: string) => {
    const g = (window as any).__game;
    return g.scene.getScenes(true).some((s: any) => s.scene.key === key);
  }, key, { timeout });
}

async function defeatEnemy(page: any, enemyKey: string, attackCount: number) {
  const pos = await getEnemyViewportPos(page, enemyKey);
  await page.mouse.click(pos.x, pos.y);
  await waitForScene(page, 'CombatScene');

  const attackPos = await page.evaluate(() => {
    const g = (window as any).__game;
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + 320 * scaleX, y: rect.top + 530 * scaleY };
  });

  // Pin rolls so attack counts are deterministic (hero=2, enemy=1)
  await page.evaluate(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    combat.rollHeroDamage = () => 2;
    combat.rollEnemyDamage = () => 1;
  });

  for (let i = 0; i < attackCount; i++) {
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForTimeout(600);
  }

  await waitForScene(page, 'MapScene');
}

test.describe('S6.0 — multiple enemies', () => {
  test('3 enemies present; defeating them one by one removes them from the map', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await waitForScene(page, 'MapScene');

    // All 3 enemies visible at start
    const initialCount = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.liveEnemies.length as number;
    });
    expect(initialCount).toBe(6);

    await page.screenshot({ path: 'test-results/s6-0-initial.png' });

    // Defeat Goblin at (4,4) — HP 3, needs 2 attacks
    await teleportHero(page, 4, 3);
    await defeatEnemy(page, '4,4', 2);

    const afterFirst = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { size: map.liveEnemies.length as number, has44: map.liveEnemies.some((e: any) => e.data.col === 4 && e.data.row === 4) as boolean };
    });
    expect(afterFirst.size).toBe(5);
    expect(afterFirst.has44).toBe(false);

    await page.screenshot({ path: 'test-results/s6-0-after-first-defeat.png' });

    // Defeat Orc at (10,7) — HP 5, needs 3 attacks
    await teleportHero(page, 10, 6);
    await defeatEnemy(page, '10,7', 3);

    const afterSecond = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { size: map.liveEnemies.length as number, has107: map.liveEnemies.some((e: any) => e.data.col === 10 && e.data.row === 7) as boolean };
    });
    expect(afterSecond.size).toBe(4);
    expect(afterSecond.has107).toBe(false);

    await page.screenshot({ path: 'test-results/s6-0-after-second-defeat.png' });
  });
});
