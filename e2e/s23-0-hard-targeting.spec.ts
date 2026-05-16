import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S23.0 — Hard difficulty: enemy focus-fires weakest stack', () => {
  test('with difficulty=hard, enemy attacks Archers (lower HP) even when Swordsmen is active', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Set difficulty=hard in registry
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.registry.set('difficulty', 'hard');
    });

    // Teleport adjacent to Goblin and trigger combat
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

    // Pin damage: hero=1 (combat lasts a couple rounds), enemy=2
    // Hard difficulty scales Goblin stackCount 3→5 (1.6×). HP per unit=1, total HP 5.
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 2;
    });

    // Initial state: active = Swordsmen (index 0). Archers (index 1) has 8 HP, Swordsmen has 20 HP.
    // So weakest = Archers, AI should target it.
    const initial = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return {
        active: combat.activeStackIndex as number,
        swordsmenHp: combat.heroArmy[0].currentHp as number,
        archersHp: combat.heroArmy[1].currentHp as number,
      };
    });
    expect(initial.active).toBe(0); // Swordsmen active
    expect(initial.swordsmenHp).toBe(20);
    expect(initial.archersHp).toBe(8);

    // Click Attack once → hero hits Goblin (5→4), Goblin hits hero (target=Archers because lower HP)
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

    // Wait for round to complete
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.roundNumber === 2;
    }, undefined, { timeout: 3000 });

    const afterRound1 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return {
        swordsmenHp: combat.heroArmy[0].currentHp as number,
        archersHp: combat.heroArmy[1].currentHp as number,
      };
    });
    // Archers should take damage (8→6), Swordsmen untouched
    expect(afterRound1.swordsmenHp).toBe(20);
    expect(afterRound1.archersHp).toBe(6);
  });
});
