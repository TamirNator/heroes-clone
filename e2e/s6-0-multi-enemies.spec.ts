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
    const sprite = map.enemySprites.get(key);
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

async function defeatEnemy(page: any, enemyKey: string) {
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

  // 3 attacks to kill enemy (HP 5, hero deals 2 per round)
  for (let i = 0; i < 3; i++) {
    await page.mouse.click(attackPos.x, attackPos.y);
    // Wait for each round to settle (attack + retaliation delay ~500ms, or victory text)
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
      return map.enemySprites.size as number;
    });
    expect(initialCount).toBe(3);

    await page.screenshot({ path: 'test-results/s6-0-initial.png' });

    // Defeat enemy[0] at (4,4)
    await teleportHero(page, 4, 3);
    await defeatEnemy(page, '4,4');

    const afterFirst = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { size: map.enemySprites.size as number, has44: map.enemySprites.has('4,4') as boolean };
    });
    expect(afterFirst.size).toBe(2);
    expect(afterFirst.has44).toBe(false);

    await page.screenshot({ path: 'test-results/s6-0-after-first-defeat.png' });

    // Defeat enemy[1] at (10,7)
    await teleportHero(page, 10, 6);
    await defeatEnemy(page, '10,7');

    const afterSecond = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { size: map.enemySprites.size as number, has107: map.enemySprites.has('10,7') as boolean };
    });
    expect(afterSecond.size).toBe(1);
    expect(afterSecond.has107).toBe(false);

    await page.screenshot({ path: 'test-results/s6-0-after-second-defeat.png' });
  });
});
