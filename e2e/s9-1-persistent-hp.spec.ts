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

async function clickAttackAndWaitForHeroHpText(page: any, expectedHeroHpText: string) {
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
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Step 1: verify fresh HP label "HP: 28/28" (default army: Swordsmen 5×4=20 + Archers 4×2=8)
    const initialLabel = await getHpLabelText(page);
    expect(initialLabel).toBe('HP: 28/28');

    const initialRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(initialRegistryHp).toBe(28);

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

    // Round 1: hero hits Goblin 3→1, Goblin retaliates Swordsmen 20→19
    await clickAttackAndWaitForHeroHpText(page, 'HP: 19/20');

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

    // Step 3: HP label should read "HP: 27/28" (Swordsmen HP 20-1=19, Archers HP 8, total 27)
    const afterGoblinLabel = await getHpLabelText(page);
    expect(afterGoblinLabel).toBe('HP: 27/28');

    const afterGoblinRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterGoblinRegistryHp).toBe(27);

    // Step 4: teleport adjacent to Orc, start combat — verify hero enters with total HP 27
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

    // Verify CombatScene starts with total heroHp=27 (Swordsmen 19 + Archers 8)
    const combatHeroHp = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroHp as number; // getter sums army currentHp
    });
    expect(combatHeroHp).toBe(27);

    // Step 5: defeat Orc (HP=5, 3 attacks × 2 = 6 ≥ 5), 2 Orc retaliations × 1 dmg
    // Swordsmen HP: 19→18→17. Total: 27→26→25
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 2;
      combat.rollEnemyDamage = () => 1;
    });

    await clickAttackAndWaitForHeroHpText(page, 'HP: 18/20');
    await clickAttackAndWaitForHeroHpText(page, 'HP: 17/20');

    // Round 3: hero kills Orc (Orc HP 5→3→1→0)
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

    // Step 6: after two fights + XP 2+4=6 → level up to 2.
    // Level-up: +1 count per stack. Swordsmen count 6, +4 HP (17→21). Archers count 5, +2 HP (8→10).
    // Total HP = 31. Max HP = 6×4+5×2=34.
    const afterOrcLabel = await getHpLabelText(page);
    expect(afterOrcLabel).toBe('HP: 31/34');

    const afterOrcRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterOrcRegistryHp).toBe(31);

    // Step 7: click Reset, HP should return to 28/28
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1210, y: 125 } });

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.liveEnemies?.length === 6 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    const afterResetLabel = await getHpLabelText(page);
    expect(afterResetLabel).toBe('HP: 28/28');

    const afterResetRegistryHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(afterResetRegistryHp).toBe(28);
  });
});
