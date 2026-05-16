import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

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

async function openTrollCombat(page: any) {
  await page.evaluate(() => {
    const g = (window as any).__game;
    if (!g.registry.has('defeatedEnemies')) {
      g.registry.set('defeatedEnemies', new Set<string>());
    }
    (g.registry.get('defeatedEnemies') as Set<string>).clear();
  });
  await waitForScene(page, 'MapScene');
    await page.evaluate(() => (window as any).__game.registry.set('lootChance', 0));
  await teleportHero(page, 15, 10);

  const pos = await page.evaluate(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const le = map.liveEnemies.find((e: any) => e.col === 15 && e.row === 11);
    const sprite = le?.sprite;
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + sprite.x * scaleX, y: rect.top + sprite.y * scaleY };
  });

  await page.mouse.click(pos.x, pos.y);
  await waitForScene(page, 'CombatScene');
}

test.describe('S6.3 — random damage rolls', () => {
  test('hero and enemy rolls produce varying values across 100 samples', async ({ page }) => {
    await page.goto('/?nointro');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    await openTrollCombat(page);

    await page.screenshot({ path: 'test-results/s6-3-random-combat.png' });

    const rollStats = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const heroRolls: number[] = [];
      const enemyRolls: number[] = [];
      for (let i = 0; i < 100; i++) {
        heroRolls.push(combat.rollHeroDamage());
        enemyRolls.push(combat.rollEnemyDamage());
      }
      return {
        heroUnique: new Set(heroRolls).size,
        enemyUnique: new Set(enemyRolls).size,
        heroMin: Math.min(...heroRolls),
        heroMax: Math.max(...heroRolls),
        enemyMin: Math.min(...enemyRolls),
        enemyMax: Math.max(...enemyRolls),
      };
    });

    expect(rollStats.heroUnique).toBeGreaterThan(1);
    expect(rollStats.enemyUnique).toBeGreaterThan(1);
    expect(rollStats.heroMin).toBeGreaterThanOrEqual(1);
    expect(rollStats.heroMax).toBeLessThanOrEqual(3);
    expect(rollStats.enemyMin).toBeGreaterThanOrEqual(2);
    expect(rollStats.enemyMax).toBeLessThanOrEqual(3);
  });

  test('pinned rolls: hero=3, Troll dmg=2 → VICTORY in 3 hits, hero ends at 6 HP', async ({ page }) => {
    await page.goto('/?nointro');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    await openTrollCombat(page);

    // Pin: hero deals 3 per hit (8/3 → ceil = 3 hits), Troll deals 2 per hit
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 3;
      combat.rollEnemyDamage = () => 2;
    });

    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + 320 * scaleX, y: rect.top + 530 * scaleY };
    });

    // 3 attacks: Troll 8→5→2→0; Swordsmen takes 2 retaliations × 2 = 4 dmg → 20→18→16
    // Total hero HP: 28→26→24
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(attackPos.x, attackPos.y);
      await page.waitForTimeout(600);
    }

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'VICTORY!');
    }, null, { timeout: 5000 });

    const combatState = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return { heroHp: combat.heroHp as number, enemyHp: combat.enemyHp as number };
    });

    expect(combatState.heroHp).toBe(24); // 28 - 4 (two Troll retaliations × 2)
    expect(combatState.enemyHp).toBe(0);
  });
});
