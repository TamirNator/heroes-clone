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

async function enterCombat(page: any, heroAdjCol: number, heroAdjRow: number, enemyKey: string) {
  // Reset defeated set so all enemies are fightable
  await page.evaluate(() => {
    const g = (window as any).__game;
    if (!g.registry.has('defeatedEnemies')) {
      g.registry.set('defeatedEnemies', new Set<string>());
    }
    (g.registry.get('defeatedEnemies') as Set<string>).clear();
  });

  await waitForScene(page, 'MapScene');
  await teleportHero(page, heroAdjCol, heroAdjRow);

  const pos = await getEnemyViewportPos(page, enemyKey);
  await page.mouse.click(pos.x, pos.y);
  await waitForScene(page, 'CombatScene');
}

async function clickReturn(page: any) {
  const returnPos = await page.evaluate(() => {
    const g = (window as any).__game;
    const combat: any = g.scene.getScene('CombatScene');
    const btn = combat.children.list.filter((c: any) => c.type === 'Rectangle')[0];
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
  });
  await page.mouse.click(returnPos.x, returnPos.y);
  await waitForScene(page, 'MapScene');
}

test.describe('S6.2 — enemy variation (different stats per enemy)', () => {
  test('each enemy has distinct name, hp, and damage passed to CombatScene', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    // Goblin at (4,4): HP 3, damageMin 1, damageMax 1
    await enterCombat(page, 4, 3, '4,4');

    const goblinData = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return {
        enemyName: combat.initData.enemyName as string,
        enemyHp: combat.initData.enemyHp as number,
        enemyDamageMin: combat.initData.enemyDamageMin as number,
        enemyDamageMax: combat.initData.enemyDamageMax as number,
        hasHpLabel: texts.some(t => t.includes('HP: 3')),
        hasNameLabel: texts.some(t => t.includes('Goblin')),
      };
    });

    expect(goblinData.enemyName).toBe('Goblin');
    expect(goblinData.enemyHp).toBe(3);
    expect(goblinData.enemyDamageMin).toBe(1);
    expect(goblinData.enemyDamageMax).toBe(1);
    expect(goblinData.hasHpLabel).toBe(true);
    expect(goblinData.hasNameLabel).toBe(true);

    await page.screenshot({ path: 'test-results/s6-2-goblin.png' });
    await clickReturn(page);

    // Orc at (10,7): HP 5, damageMin 1, damageMax 2
    await enterCombat(page, 10, 6, '10,7');

    const orcData = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return {
        enemyName: combat.initData.enemyName as string,
        enemyHp: combat.initData.enemyHp as number,
        enemyDamageMin: combat.initData.enemyDamageMin as number,
        enemyDamageMax: combat.initData.enemyDamageMax as number,
        hasHpLabel: texts.some(t => t.includes('HP: 5')),
        hasNameLabel: texts.some(t => t.includes('Orc')),
      };
    });

    expect(orcData.enemyName).toBe('Orc');
    expect(orcData.enemyHp).toBe(5);
    expect(orcData.enemyDamageMin).toBe(1);
    expect(orcData.enemyDamageMax).toBe(2);
    expect(orcData.hasHpLabel).toBe(true);
    expect(orcData.hasNameLabel).toBe(true);

    await page.screenshot({ path: 'test-results/s6-2-orc.png' });
    await clickReturn(page);

    // Troll at (15,11): HP 8, damageMin 2, damageMax 3
    await enterCombat(page, 15, 10, '15,11');

    const trollData = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return {
        enemyName: combat.initData.enemyName as string,
        enemyHp: combat.initData.enemyHp as number,
        enemyDamageMin: combat.initData.enemyDamageMin as number,
        enemyDamageMax: combat.initData.enemyDamageMax as number,
        hasHpLabel: texts.some(t => t.includes('HP: 8')),
        hasNameLabel: texts.some(t => t.includes('Troll')),
      };
    });

    expect(trollData.enemyName).toBe('Troll');
    expect(trollData.enemyHp).toBe(8);
    expect(trollData.enemyDamageMin).toBe(2);
    expect(trollData.enemyDamageMax).toBe(3);
    expect(trollData.hasHpLabel).toBe(true);
    expect(trollData.hasNameLabel).toBe(true);

    await page.screenshot({ path: 'test-results/s6-2-troll.png' });
    await clickReturn(page);
  });
});
