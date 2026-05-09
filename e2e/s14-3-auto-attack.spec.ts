import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S14.3 — auto-attack toggle', () => {
  test('toggling AUTO drives combat to VICTORY without further clicks', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport hero adjacent to Troll at (15,11)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 14;
      map.heroRow = 11;
      const x = map.startX + 14 * map.colStep + (11 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 11 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    const trollPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const le = map.liveEnemies.find((e: any) => e.col === 15 && e.row === 11);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + le.sprite.x * (rect.width / g.config.width),
        y: rect.top + le.sprite.y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(trollPos.x, trollPos.y);
    await waitForScene(page, 'CombatScene');

    // Pin damage: hero=2, enemy=0 (so combat eventually ends in hero victory; enemy can't kill us)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 2;
      combat.rollEnemyDamage = () => 0;
    });

    // Click AUTO button to toggle on
    const autoPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 470 * (rect.width / g.config.width),
        y: rect.top + 530 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(autoPos.x, autoPos.y);

    // Verify auto is on
    const autoOn = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.autoAttack as boolean;
    });
    expect(autoOn).toBe(true);

    // Wait for combat to be over (auto should drive it to victory)
    // Troll has HP 8, hero deals 2/round → 4 rounds. Each round ~800ms → ~3.5s total + AUTO 200ms gaps
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.combatOver === true && combat.logLines.includes('VICTORY!');
    }, undefined, { timeout: 15000 });

    await page.screenshot({ path: 'test-results/s14-3-auto-victory.png' });
  });
});
