import { test, expect } from '@playwright/test';

const SAVE_KEY = 'heroes-clone:save';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function defeatGoblin(page: any) {
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
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + le.sprite.x * scaleX, y: rect.top + le.sprite.y * scaleY };
  });

  await page.mouse.click(goblinPos.x, goblinPos.y);
  await waitForScene(page, 'CombatScene');

  // Pin rolls: hero deals 2, Goblin deals 1 (2 hits kill Goblin)
  await page.evaluate(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    combat.rollHeroDamage = () => 2;
    combat.rollEnemyDamage = () => 1;
  });

  const attackPos = await page.evaluate(() => {
    const g = (window as any).__game;
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + 320 * scaleX, y: rect.top + 530 * scaleY };
  });

  // Click Attack twice to defeat Goblin (HP 3 → 1 → 0)
  await page.mouse.click(attackPos.x, attackPos.y);
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    const texts: string[] = combat.children.list
      .filter((c: any) => c.type === 'Text')
      .map((c: any) => c.text as string);
    return texts.some(t => t === 'HP: 9');
  }, null, { timeout: 3000 });

  await page.mouse.click(attackPos.x, attackPos.y);
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    const texts: string[] = combat.children.list
      .filter((c: any) => c.type === 'Text')
      .map((c: any) => c.text as string);
    return texts.some(t => t === 'VICTORY!');
  }, null, { timeout: 3000 });

  await waitForScene(page, 'MapScene', 8000);
}

test.describe('S7.1 — save/load progress', () => {
  test('defeat saves to localStorage; reload restores hero position and defeated enemies', async ({ page }) => {
    await page.goto('/');
    // Clear any stale save from previous tests
    await page.evaluate(() => localStorage.clear());
    // Reload to start fresh with cleared storage
    await page.reload();
    await waitForScene(page, 'MapScene');

    await defeatGoblin(page);

    // Verify localStorage was written
    const rawSave = await page.evaluate((key: string) => localStorage.getItem(key), SAVE_KEY);
    expect(rawSave).not.toBeNull();

    const save = JSON.parse(rawSave!);
    expect(save.defeated).toContain('4,4');
    expect(save.heroCol).toBe(4);
    expect(save.heroRow).toBe(4);

    // Reload the page — save should be restored
    await page.reload();
    await waitForScene(page, 'MapScene');

    await page.screenshot({ path: 'test-results/s7-1-after-reload.png' });

    const mapState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        enemyCount: map.liveEnemies.length as number,
        heroCol: map.heroCol as number,
        heroRow: map.heroRow as number,
      };
    });

    expect(mapState.enemyCount).toBe(2);
    expect(mapState.heroCol).toBe(4);
    expect(mapState.heroRow).toBe(4);
  });

  test('Reset button clears save and restarts with 3 enemies at origin', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    await defeatGoblin(page);

    // Verify something is saved
    const hasSave = await page.evaluate((key: string) => localStorage.getItem(key) !== null, SAVE_KEY);
    expect(hasSave).toBe(true);

    // Click Reset button — center at game coords (1210, 125), canvas at 1:1 scale
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1210, y: 125 } });

    // Wait for MapScene to restart with 3 enemies
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.liveEnemies?.length === 3 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s7-1-after-reset.png' });

    const afterReset = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        enemyCount: map.liveEnemies.length as number,
        heroCol: map.heroCol as number,
        heroRow: map.heroRow as number,
        gameWon: map.gameWon as boolean,
      };
    });

    expect(afterReset.enemyCount).toBe(3);
    expect(afterReset.heroCol).toBe(0);
    expect(afterReset.heroRow).toBe(0);
    expect(afterReset.gameWon).toBe(false);

    const saveGone = await page.evaluate((key: string) => localStorage.getItem(key) === null, SAVE_KEY);
    expect(saveGone).toBe(true);
  });
});
