import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function countPotionSprites(page: any): Promise<number> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    return map.children.list.filter((c: any) => c.type === 'Text' && c.text === '+').length as number;
  });
}

test.describe('S11.0 — HP potions on map', () => {
  test('initial render shows 3 potions', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    await page.screenshot({ path: 'test-results/s11-0-initial.png' });

    const count = await countPotionSprites(page);
    expect(count).toBe(3);
  });

  test('walking onto potion heals hero and destroys sprite', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Set hero HP to 5 so +5 heals to exactly 10 (max at level 1)
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.registry.set('heroHp', 5);
      const map = g.scene.getScene('MapScene') as any;
      map.heroHpLabel.setText('HP: 5/10');
    });

    // Teleport hero adjacent to potion at (7,9) — place at (6,9) (1 step away)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 6;
      map.heroRow = 9;
      const x = map.startX + 6 * map.colStep + (9 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 9 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click the potion hex (7,9)
    const potionScreenPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const { x, y } = map.hexCenter(7, 9);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + x * (rect.width / g.config.width),
        y: rect.top + y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(potionScreenPos.x, potionScreenPos.y);

    // Wait for animation to finish (hero arrives at potion hex)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false && map?.heroCol === 7 && map?.heroRow === 9;
    }, null, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s11-0-after-pickup.png' });

    const heroHp = await page.evaluate(() => (window as any).__game.registry.get('heroHp') as number);
    expect(heroHp).toBe(10);

    const hpLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string)
        .find((t: string) => t.startsWith('HP:')) ?? '';
    });
    expect(hpLabel).toBe('HP: 10/10');

    // Potion sprite should be removed
    const potionCount = await countPotionSprites(page);
    expect(potionCount).toBe(2);

    // consumedPotions registry should contain the key
    const isConsumed = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedPotions') as Set<string>).has('7,9');
    });
    expect(isConsumed).toBe(true);
  });

  test('consumed potion persists after reload; Reset restores all 3', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport adjacent and pick up potion at (7,9)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 6;
      map.heroRow = 9;
      const x = map.startX + 6 * map.colStep + (9 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 9 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    const potionScreenPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const { x, y } = map.hexCenter(7, 9);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + x * (rect.width / g.config.width),
        y: rect.top + y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(potionScreenPos.x, potionScreenPos.y);
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false && map?.heroCol === 7 && map?.heroRow === 9;
    }, null, { timeout: 5000 });

    // Reload — save should have consumed: ["7,9"]
    await page.reload();
    await waitForScene(page, 'MapScene');

    const countAfterReload = await countPotionSprites(page);
    expect(countAfterReload).toBe(2);

    const consumedAfterReload = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedPotions') as Set<string>).has('7,9');
    });
    expect(consumedAfterReload).toBe(true);

    // Click Reset — should restore all 3 potions
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1210, y: 125 } });

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.liveEnemies?.length === 6 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    const countAfterReset = await countPotionSprites(page);
    expect(countAfterReset).toBe(3);

    const consumedAfterReset = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedPotions') as Set<string>).has('7,9');
    });
    expect(consumedAfterReset).toBe(false);
  });
});
