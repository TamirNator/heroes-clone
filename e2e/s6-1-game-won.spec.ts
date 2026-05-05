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

async function defeatEnemyViaAttack(page: any, enemyKey: string) {
  const pos = await page.evaluate((key: string) => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    const sprite = map.enemySprites.get(key);
    const cvs: HTMLCanvasElement = g.canvas;
    const rect = cvs.getBoundingClientRect();
    const scaleX = rect.width / g.config.width;
    const scaleY = rect.height / g.config.height;
    return { x: rect.left + sprite.x * scaleX, y: rect.top + sprite.y * scaleY };
  }, enemyKey);

  await page.mouse.click(pos.x, pos.y);
  await waitForScene(page, 'CombatScene');

  // Pin rolls: hero=2 (Troll HP 8 → 4 hits), enemy capped at min so hero survives
  await page.evaluate(() => {
    const g = (window as any).__game;
    const combat = g.scene.getScene('CombatScene') as any;
    combat.rollHeroDamage = () => 2;
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

  for (let i = 0; i < 4; i++) {
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForTimeout(600);
  }

  await waitForScene(page, 'MapScene');

  // Wait for gameWon to be set — confirms create() fully completed with win overlay
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    return map?.gameWon === true;
  }, null, { timeout: 5000 });
}

test.describe('S6.1 — game won state', () => {
  test('defeating all 3 enemies shows GAME WON overlay; New Game resets', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await waitForScene(page, 'MapScene');

    // Shortcut: pre-populate registry with 2 of the 3 enemies already defeated,
    // then do the real click flow for the last one to exercise the win condition trigger.
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      if (!g.registry.has('defeatedEnemies')) {
        g.registry.set('defeatedEnemies', new Set<string>());
      }
      (g.registry.get('defeatedEnemies') as Set<string>).add('4,4');
      (g.registry.get('defeatedEnemies') as Set<string>).add('10,7');
      // Remove sprites visually so they don't confuse the encounter trigger
      map.enemySprites.get('4,4')?.destroy();
      map.enemySprites.delete('4,4');
      map.enemySprites.get('10,7')?.destroy();
      map.enemySprites.delete('10,7');
    });

    // Defeat the last enemy at (15,11) through the full combat flow
    // (15,10) is even row; [0,1] neighbor = (15,11) — one step away
    await teleportHero(page, 15, 10);
    await defeatEnemyViaAttack(page, '15,11');

    // Win overlay confirmed present; verify state
    const wonState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const texts: string[] = map.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return {
        gameWon: map.gameWon as boolean,
        hasWonText: texts.some(t => t.includes('GAME WON!')),
        enemyCount: map.enemySprites.size as number,
      };
    });

    expect(wonState.gameWon).toBe(true);
    expect(wonState.hasWonText).toBe(true);
    expect(wonState.enemyCount).toBe(0);

    await page.screenshot({ path: 'test-results/s6-1-game-won.png' });

    // Click New Game button at game coords (640, 460) relative to canvas top-left.
    // Using locator.click({ position }) is offset from the element's top-left,
    // which equals game coords directly since the canvas has 1:1 scaling.
    await canvas.click({ position: { x: 640, y: 460 } });

    // Wait for MapScene to restart with all 3 enemies and gameWon cleared
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.enemySprites?.size === 3 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    const afterNewGame = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        enemyCount: map.enemySprites.size as number,
        heroCol: map.heroCol as number,
        heroRow: map.heroRow as number,
        gameWon: map.gameWon as boolean,
      };
    });

    expect(afterNewGame.enemyCount).toBe(3);
    expect(afterNewGame.heroCol).toBe(0);
    expect(afterNewGame.heroRow).toBe(0);
    expect(afterNewGame.gameWon).toBe(false);

    await page.screenshot({ path: 'test-results/s6-1-after-new-game.png' });
  });
});
