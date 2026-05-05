import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S8.0 — terrain types + impassable tiles', () => {
  test('terrain tiles render with correct fill colors', async ({ page }) => {
    await page.goto('/');
    await waitForScene(page, 'MapScene');

    await page.screenshot({ path: 'test-results/s8-0-terrain.png' });

    const counts = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const polys = map.children.list.filter((c: any) => c.type === 'Polygon');
      const grass = polys.filter((p: any) => p.fillColor === 0x2a3a4a).length as number;
      const forest = polys.filter((p: any) => p.fillColor === 0x2d4a2d).length as number;
      const water = polys.filter((p: any) => p.fillColor === 0x1a3a5a).length as number;
      return { total: polys.length as number, grass, forest, water };
    });

    expect(counts.total).toBe(300);
    expect(counts.water).toBe(8);
    expect(counts.forest).toBe(10);
    expect(counts.grass).toBe(282);
  });

  test('clicking water tile does not move hero', async ({ page }) => {
    await page.goto('/');
    await waitForScene(page, 'MapScene');

    const waterPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      // tile (6,3) is water; row 3 is odd
      const x = map.startX + 6 * map.colStep + (3 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 3 * map.rowStep;
      return { x: rect.left + x * scaleX, y: rect.top + y * scaleY };
    });

    await page.mouse.click(waterPos.x, waterPos.y);
    await page.waitForTimeout(500);

    const heroPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { col: map.heroCol as number, row: map.heroRow as number };
    });

    expect(heroPos.col).toBe(0);
    expect(heroPos.row).toBe(0);
  });

  test('enemy AI does not path through water', async ({ page }) => {
    await page.goto('/');
    await waitForScene(page, 'MapScene');

    // Teleport hero to (8,3) — north of the water patch at (6-7, 3-4)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 8;
      map.heroRow = 3;
      const x = map.startX + 8 * map.colStep + (3 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 3 * map.rowStep;
      map.heroSprite.setPosition(x, y);
    });

    // Click End Turn button (center at game coords 1280-20-60, 50+18)
    const endTurnPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + (1280 - 20 - 60) * scaleX, y: rect.top + (50 + 18) * scaleY };
    });

    await page.mouse.click(endTurnPos.x, endTurnPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false;
    }, null, { timeout: 3000 });

    const goblinState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const goblin = map.liveEnemies.find((e: any) => e.data.col === 4 && e.data.row === 4);
      const WATER = new Set(['6,3', '7,3', '6,4', '7,4', '13,5', '13,6', '13,7', '13,8']);
      const tileKey = `${goblin.col},${goblin.row}`;
      return {
        col: goblin.col as number,
        row: goblin.row as number,
        isOnWater: WATER.has(tileKey) as boolean,
        movedFromOrigin: (goblin.col !== 4 || goblin.row !== 4) as boolean,
      };
    });

    expect(goblinState.movedFromOrigin).toBe(true);
    expect(goblinState.isOnWater).toBe(false);
  });

  test('hero can walk around water patch', async ({ page }) => {
    await page.goto('/');
    await waitForScene(page, 'MapScene');

    // Teleport hero to (5,3) with extra moves
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 5;
      map.heroRow = 3;
      const x = map.startX + 5 * map.colStep + (3 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 3 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 10;
    });

    // Click (8,4) — reachable by going below the water patch
    const targetPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      const x = map.startX + 8 * map.colStep + (4 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 4 * map.rowStep;
      return { x: rect.left + x * scaleX, y: rect.top + y * scaleY };
    });

    await page.mouse.click(targetPos.x, targetPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false;
    }, null, { timeout: 5000 });

    const heroPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return { col: map.heroCol as number, row: map.heroRow as number };
    });

    // Hero should have moved away from (5,3)
    expect(heroPos.col !== 5 || heroPos.row !== 3).toBe(true);
  });
});
