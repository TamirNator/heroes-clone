import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function getHpLabelText(page: any): Promise<string> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const texts: string[] = map.children.list
      .filter((c: any) => c.type === 'Text')
      .map((c: any) => c.text as string);
    return texts.find(t => t.startsWith('HP:')) ?? '';
  });
}

async function getXpLabelText(page: any): Promise<string> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const texts: string[] = map.children.list
      .filter((c: any) => c.type === 'Text')
      .map((c: any) => c.text as string);
    return texts.find(t => t.startsWith('Lvl')) ?? '';
  });
}

async function defeatEnemy(page: any, enemyKey: string, attacks: number) {
  const pos = await page.evaluate((key: string) => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const [ecol, erow] = key.split(',').map(Number);
    const le = map.liveEnemies.find((e: any) => e.col === ecol && e.row === erow);
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    return {
      x: rect.left + le.sprite.x * (rect.width / g.config.width),
      y: rect.top + le.sprite.y * (rect.height / g.config.height),
    };
  }, enemyKey);

  await page.mouse.click(pos.x, pos.y);
  await waitForScene(page, 'CombatScene');

  await page.evaluate(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    combat.rollHeroDamage = () => 3;
    combat.rollEnemyDamage = () => 0;
  });

  const attackPos = await page.evaluate(() => {
    const g = (window as any).__game;
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    return {
      x: rect.left + 320 * (rect.width / g.config.width),
      y: rect.top + 530 * (rect.height / g.config.height),
    };
  });

  for (let i = 0; i < attacks; i++) {
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForTimeout(600);
  }

  await waitForScene(page, 'MapScene');
}

test.describe('S10.0 — hero XP + levels', () => {
  test('initial state is Lvl 1, XP 0, HP 28/28', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    const hpLabel = await getHpLabelText(page);
    expect(hpLabel).toBe('HP: 28/28'); // default army: 5×4 + 4×2 = 28

    const xpLabel = await getXpLabelText(page);
    expect(xpLabel).toBe('Lvl 1 • XP: 0/5');

    const registryState = await page.evaluate(() => {
      const g = (window as any).__game;
      return {
        xp: g.registry.get('heroXp') as number,
        level: g.registry.get('heroLevel') as number,
        hp: g.registry.get('heroHp') as number,
      };
    });
    expect(registryState.xp).toBe(0);
    expect(registryState.level).toBe(1);
    expect(registryState.hp).toBe(28);
  });

  test('defeating Goblin grants 2 XP; defeating Orc levels up to Lvl 2', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport adjacent to Goblin at (4,4)
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

    // Defeat Goblin (HP 3, 1 attack at dmg 3)
    await defeatEnemy(page, '4,4', 1);

    await page.screenshot({ path: 'test-results/s10-0-after-goblin.png' });

    const afterGoblinXp = await page.evaluate(() => (window as any).__game.registry.get('heroXp') as number);
    expect(afterGoblinXp).toBe(2);

    const afterGoblinLevel = await page.evaluate(() => (window as any).__game.registry.get('heroLevel') as number);
    expect(afterGoblinLevel).toBe(1);

    const afterGoblinXpLabel = await getXpLabelText(page);
    expect(afterGoblinXpLabel).toBe('Lvl 1 • XP: 2/5');

    // Teleport adjacent to Orc at (10,7)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 10;
      map.heroRow = 6;
      const x = map.startX + 10 * map.colStep + (6 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 6 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Defeat Orc (HP 5, 2 attacks at dmg 3)
    await defeatEnemy(page, '10,7', 2);

    await page.screenshot({ path: 'test-results/s10-0-after-level-up.png' });

    const afterOrcXp = await page.evaluate(() => (window as any).__game.registry.get('heroXp') as number);
    expect(afterOrcXp).toBe(6);

    const afterOrcLevel = await page.evaluate(() => (window as any).__game.registry.get('heroLevel') as number);
    expect(afterOrcLevel).toBe(2);

    // Level-up: +1 count per stack. Swordsmen count 6, +4 HP (was 20, now 24).
    // Archers count 5, +2 HP (was 8, now 10). Total HP = 34. Max = 34.
    const afterOrcHp = await page.evaluate(() => (window as any).__game.registry.get('heroHp') as number);
    expect(afterOrcHp).toBe(34); // enemy dmg=0, no damage taken, army leveled up to full

    const afterOrcHpLabel = await getHpLabelText(page);
    expect(afterOrcHpLabel).toBe('HP: 34/34');

    const afterOrcXpLabel = await getXpLabelText(page);
    expect(afterOrcXpLabel).toBe('Lvl 2 • XP: 6/12');
  });
});
