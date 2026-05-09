import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S15.0 — enemy multi-stack rendering', () => {
  test('Goblin (stackCount=3) renders as 3 circles; hide rightmost on unit death', async ({ page }) => {
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

    const goblinPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const le = map.liveEnemies.find((e: any) => e.col === 4 && e.row === 4);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + le.sprite.x * (rect.width / g.config.width),
        y: rect.top + le.sprite.y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(goblinPos.x, goblinPos.y);
    await waitForScene(page, 'CombatScene');

    // Verify 3 enemy sprites rendered (Goblin stackCount=3)
    const enemyCount = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemySprites.length as number;
    });
    expect(enemyCount).toBe(3);

    await page.screenshot({ path: 'test-results/s15-0-three-goblins.png' });

    // Pin hero damage = 1 (kills 1 Goblin unit since hpPerUnit=1)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 0;
    });

    // Click Attack
    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 320 * (rect.width / g.config.width),
        y: rect.top + 530 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(attackPos.x, attackPos.y);

    // Wait for damage to apply (lunge peak ~100ms)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp === 2;
    }, undefined, { timeout: 1500 });

    // Rightmost (index 2) should be hidden, [0] and [1] still visible
    const visibilities = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemySprites.map((s: any) => s.visible) as boolean[];
    });
    expect(visibilities).toEqual([true, true, false]);

    await page.screenshot({ path: 'test-results/s15-0-after-one-killed.png' });
  });
});
