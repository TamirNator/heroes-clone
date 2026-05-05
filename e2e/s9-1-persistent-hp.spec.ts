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

async function clickAttackAndWaitForRetaliation(page: any, expectedHeroHpText: string) {
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
  await page.waitForFunction((t: string) => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    return combat?.children?.list
      .filter((c: any) => c.type === 'Text')
      .map((c: any) => c.text as string)
      .some((s: string) => s === t);
  }, expectedHeroHpText, { timeout: 3000 });
}

test.describe('S9.1 — persistent hero HP between combats', () => {
  test('hero HP persists across fights and resets on Reset', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Step 1: verify fresh HP label "HP: 10/10"
    const initialLabel = await getHpLabelText(page);
    expect(initialLabel).toBe('HP: 10/10');

    const initialRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(initialRegistryHp).toBe(10);

    // Step 2: pin rolls, teleport adjacent to Goblin, defeat it
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

    // Pin rolls: hero=2, Goblin=1
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 2;
      combat.rollEnemyDamage = () => 1;
    });

    // Round 1: hero hits Goblin 3→1, Goblin retaliates hero 10→9
    await clickAttackAndWaitForRetaliation(page, 'HP: 9');

    // Round 2: hero kills Goblin, VICTORY
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

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat?.children?.list
        .filter((c: any) => c.type === 'Text')
        .some((c: any) => c.text === 'VICTORY!');
    }, null, { timeout: 3000 });

    await waitForScene(page, 'MapScene');

    // Step 3: HP label should read "HP: 9/10", registry should be 9
    const afterGoblinLabel = await getHpLabelText(page);
    expect(afterGoblinLabel).toBe('HP: 9/10');

    const afterGoblinRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterGoblinRegistryHp).toBe(9);

    // Step 4: teleport adjacent to Orc, start combat — verify hero enters with HP 9
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

    const orcPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const le = map.liveEnemies.find((e: any) => e.col === 10 && e.row === 7);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + le.sprite.x * (rect.width / g.config.width),
        y: rect.top + le.sprite.y * (rect.height / g.config.height),
      };
    });

    await page.mouse.click(orcPos.x, orcPos.y);
    await waitForScene(page, 'CombatScene');

    // Verify CombatScene starts with heroHp=9, not 10
    const combatHeroHp = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroHp as number;
    });
    expect(combatHeroHp).toBe(9);

    // Step 5: defeat Orc — 3 attacks (Orc HP 5, hero dmg 2), 2 retaliations (Orc dmg 1)
    // Hero: 9 → 8 → 7, Orc: 5 → 3 → 1 → 0
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 2;
      combat.rollEnemyDamage = () => 1;
    });

    await clickAttackAndWaitForRetaliation(page, 'HP: 8');
    await clickAttackAndWaitForRetaliation(page, 'HP: 7');

    // Round 3: hero kills Orc
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat?.children?.list
        .filter((c: any) => c.type === 'Text')
        .some((c: any) => c.text === 'VICTORY!');
    }, null, { timeout: 3000 });

    await waitForScene(page, 'MapScene');

    await page.screenshot({ path: 'test-results/s9-1-after-two-fights.png' });

    // Step 6: after two fights, HP should be 7
    const afterOrcLabel = await getHpLabelText(page);
    expect(afterOrcLabel).toBe('HP: 7/10');

    const afterOrcRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterOrcRegistryHp).toBe(7);

    // Step 7: click Reset, HP should return to 10
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1210, y: 125 } });

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.liveEnemies?.length === 5 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    const afterResetLabel = await getHpLabelText(page);
    expect(afterResetLabel).toBe('HP: 10/10');

    const afterResetRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterResetRegistryHp).toBe(10);
  });
});
