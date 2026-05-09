import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function waitForAnimationDone(page: any, timeout = 3000) {
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    return map?.isAnimating === false;
  }, null, { timeout });
}

test.describe('S8.1 — terrain movement cost', () => {
  // Hex topology note:
  // From (1,1) [odd row], neighbor (2,1) costs 1 (grass), and from (2,1) neighbor (3,2) costs 2 (forest).
  // Dijkstra finds shortest-cost path (1,1)→(2,1)→(3,2): cost=3, 2 hops.

  test('forest tile costs 2 movement points to enter', async ({ page }) => {
    await page.goto('/?nointro');
    await waitForScene(page, 'MapScene');

    // Teleport hero to (1,1) with budget 5
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 1;
      map.heroRow = 1;
      const x = map.startX + 1 * map.colStep + (1 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 1 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click (3,2) which is forest
    const forestPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      // (3,2) forest; row 2 is even
      const x = map.startX + 3 * map.colStep + (2 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 2 * map.rowStep;
      return { x: rect.left + x * scaleX, y: rect.top + y * scaleY };
    });

    await page.mouse.click(forestPos.x, forestPos.y);
    await waitForAnimationDone(page);

    await page.screenshot({ path: 'test-results/s8-1-after-forest-walk.png' });

    const heroState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        col: map.heroCol as number,
        row: map.heroRow as number,
        remaining: map.remainingMoves as number,
      };
    });

    // Dijkstra finds (1,1)→(2,1)[cost 1]→(3,2)[forest, cost 2] = total cost 3, remaining = 5-3 = 2
    expect(heroState.col).toBe(3);
    expect(heroState.row).toBe(2);
    expect(heroState.remaining).toBe(2);
  });

  test('path truncated at budget boundary — cannot enter forest when budget exhausted', async ({ page }) => {
    await page.goto('/?nointro');
    await waitForScene(page, 'MapScene');

    // Teleport hero to (1,1) with budget 1 (just enough for one grass step)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 1;
      map.heroRow = 1;
      const x = map.startX + 1 * map.colStep + (1 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 1 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 1;
    });

    // Click (3,2) forest — path is (2,1)[cost 1] then (3,2)[cost 2]; budget 1 covers only first step
    const forestPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      const x = map.startX + 3 * map.colStep + (2 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 2 * map.rowStep;
      return { x: rect.left + x * scaleX, y: rect.top + y * scaleY };
    });

    await page.mouse.click(forestPos.x, forestPos.y);
    await waitForAnimationDone(page);

    const heroState = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return {
        col: map.heroCol as number,
        row: map.heroRow as number,
        remaining: map.remainingMoves as number,
      };
    });

    // Budget 1: take (2,1) cost 1 (spent=1), then (3,2) cost 2 would exceed budget — stop at (2,1)
    expect(heroState.col).toBe(2);
    expect(heroState.row).toBe(1);
    expect(heroState.remaining).toBe(0);
  });

  test('Dijkstra picks cheaper all-grass route over forest shortcut', async ({ page }) => {
    await page.goto('/?nointro');
    await waitForScene(page, 'MapScene');

    // Teleport hero to (1,1) with ample budget
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 1;
      map.heroRow = 1;
      const x = map.startX + 1 * map.colStep + (1 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 1 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 10;
    });

    // Click (4,3) — any path through forest (2,2),(3,2),(2,3) costs more than the all-grass route
    // All-grass route: (1,1)→(2,1)→(3,1)→(4,2)→(4,3) = cost 4
    // Any path entering a forest tile costs at least 5 (forest tiles add 2 instead of 1)
    const targetPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      // (4,3); row 3 is odd
      const x = map.startX + 4 * map.colStep + (3 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 3 * map.rowStep;
      return { x: rect.left + x * scaleX, y: rect.top + y * scaleY };
    });

    await page.mouse.click(targetPos.x, targetPos.y);
    await waitForAnimationDone(page);

    const pathInfo = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const FOREST = new Set(['2,2', '3,2', '2,3', '8,9', '9,9', '8,10', '9,10', '16,3', '17,3', '16,4']);
      const path: Array<{ col: number; row: number }> = map.lastPath;
      const hasForest = path.some((h: { col: number; row: number }) => FOREST.has(`${h.col},${h.row}`));
      return {
        pathLength: path.length as number,
        hasForest: hasForest as boolean,
        heroCol: map.heroCol as number,
        heroRow: map.heroRow as number,
      };
    });

    // Dijkstra finds the all-grass path (cost 4) rather than any forest path (cost ≥ 5)
    expect(pathInfo.pathLength).toBeGreaterThan(0);
    expect(pathInfo.hasForest).toBe(false);
    // Hero should have reached (4,3)
    expect(pathInfo.heroCol).toBe(4);
    expect(pathInfo.heroRow).toBe(3);
  });
});
