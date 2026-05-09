import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function countScrollSprites(page: any): Promise<number> {
  return page.evaluate(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    return map.children.list.filter((c: any) => c.type === 'Text' && c.text === 'B' && c.style?.color === '#4488cc').length as number;
  });
}

test.describe('S11.1 — XP scrolls on map', () => {
  test('initial render shows 2 scrolls', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    const count = await countScrollSprites(page);
    expect(count).toBe(2);
  });

  test('walking onto scroll grants +3 XP, removes sprite', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Pre-set XP=2 via registry so that picking up scroll (12,8) pushes to 5 → level up
    await page.evaluate(() => {
      const g = (window as any).__game;
      g.registry.set('heroXp', 2);
    });

    // Teleport hero adjacent to scroll at (12,8) — place at (11,8)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 11;
      map.heroRow = 8;
      const x = map.startX + 11 * map.colStep + (8 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 8 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click the scroll hex (12,8)
    const scrollScreenPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const { x, y } = map.hexCenter(12, 8);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + x * (rect.width / g.config.width),
        y: rect.top + y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(scrollScreenPos.x, scrollScreenPos.y);

    // Wait for animation to finish
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false && map?.heroCol === 12 && map?.heroRow === 8;
    }, null, { timeout: 5000 });

    await page.screenshot({ path: 'test-results/s11-1-after-pickup.png' });

    const heroXp = await page.evaluate(() => (window as any).__game.registry.get('heroXp') as number);
    expect(heroXp).toBe(5);

    // XP 2 + 3 = 5 >= threshold 5 → level up to 2
    const heroLevel = await page.evaluate(() => (window as any).__game.registry.get('heroLevel') as number);
    expect(heroLevel).toBe(2);

    // Level-up: +1 count per stack. Swordsmen count 6, +4 HP (20→24). Archers count 5, +2 HP (8→10).
    // Total HP = 34.
    const heroHp = await page.evaluate(() => (window as any).__game.registry.get('heroHp') as number);
    expect(heroHp).toBe(34);

    // Scroll sprite should be removed
    const scrollCount = await countScrollSprites(page);
    expect(scrollCount).toBe(1);

    // consumedScrolls registry should contain the key
    const isConsumed = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedScrolls') as Set<string>).has('12,8');
    });
    expect(isConsumed).toBe(true);
  });

  test('consumed scroll persists after reload; Reset restores all 2', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport adjacent and pick up scroll at (12,8)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 11;
      map.heroRow = 8;
      const x = map.startX + 11 * map.colStep + (8 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 8 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    const scrollScreenPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const { x, y } = map.hexCenter(12, 8);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + x * (rect.width / g.config.width),
        y: rect.top + y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(scrollScreenPos.x, scrollScreenPos.y);
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false && map?.heroCol === 12 && map?.heroRow === 8;
    }, null, { timeout: 5000 });

    // Reload — save should have consumedScrolls: ["12,8"]
    await page.reload();
    await waitForScene(page, 'MapScene');

    const countAfterReload = await countScrollSprites(page);
    expect(countAfterReload).toBe(1);

    const consumedAfterReload = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedScrolls') as Set<string>).has('12,8');
    });
    expect(consumedAfterReload).toBe(true);

    // Click Reset — should restore all 2 scrolls
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1210, y: 125 } });

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.liveEnemies?.length === 6 && map?.gameWon === false;
    }, null, { timeout: 5000 });

    const countAfterReset = await countScrollSprites(page);
    expect(countAfterReset).toBe(2);

    const consumedAfterReset = await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.registry.get('consumedScrolls') as Set<string>).has('12,8');
    });
    expect(consumedAfterReset).toBe(false);

    const xpAfterReset = await page.evaluate(() => (window as any).__game.registry.get('heroXp') as number);
    expect(xpAfterReset).toBe(0);

    const levelAfterReset = await page.evaluate(() => (window as any).__game.registry.get('heroLevel') as number);
    expect(levelAfterReset).toBe(1);
  });
});
