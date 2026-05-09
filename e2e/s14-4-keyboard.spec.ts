import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S14.4 — keyboard shortcuts in combat', () => {
  test('A triggers Attack, 2 selects Archers stack, O toggles Auto', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport hero adjacent to Goblin
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

    // Click on canvas to give it keyboard focus
    await page.mouse.click(640, 360);

    // Pin damage so behavior is deterministic
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 0;
    });

    // Press '2' to select Archers
    await page.keyboard.press('2');
    const activeAfter2 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.activeStackIndex as number;
    });
    expect(activeAfter2).toBe(1);

    // Press 'O' to toggle Auto on
    await page.keyboard.press('O');
    const autoOn = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.autoAttack as boolean;
    });
    expect(autoOn).toBe(true);

    // Press 'O' again to toggle off
    await page.keyboard.press('O');
    const autoOff = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.autoAttack as boolean;
    });
    expect(autoOff).toBe(false);

    // Press 'A' to attack
    const enemyHpBefore = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp as number;
    });
    await page.keyboard.press('A');

    // Wait for damage to apply (lunge peak ~100ms)
    await page.waitForFunction((before: number) => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp < before;
    }, enemyHpBefore, { timeout: 1500 });

    const enemyHpAfter = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp as number;
    });
    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
  });
});
