import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function waitForAnimating(page: any, value: boolean, timeout = 10000) {
  await page.waitForFunction((v: boolean) => {
    const g = (window as any).__game;
    const map = g.scene.getScene('MapScene') as any;
    return map?.isAnimating === v;
  }, value, { timeout });
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

async function clickEndTurn(page: any) {
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 1210, y: 68 } });
}

test.describe('S9.2 — Archer ranged enemy', () => {
  test('Archer moves toward hero when out of range (>3 hops)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Hero at (0,0), Archer at (8,12) — many hops away, should move not shoot
    const initialArcherPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const archer = map.liveEnemies.find((e: any) => e.data.name === 'Archer');
      return { col: archer.col as number, row: archer.row as number };
    });
    expect(initialArcherPos.col).toBe(8);
    expect(initialArcherPos.row).toBe(12);

    const initialHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });

    await clickEndTurn(page);
    await waitForAnimating(page, false);

    const afterPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const archer = map.liveEnemies.find((e: any) => e.data.name === 'Archer');
      return { col: archer.col as number, row: archer.row as number };
    });

    // Archer must have moved (not stayed at 8,12)
    const archerMoved = afterPos.col !== initialArcherPos.col || afterPos.row !== initialArcherPos.row;
    expect(archerMoved).toBe(true);

    // Hero HP must be unchanged (Archer didn't shoot)
    const hpAfter = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(hpAfter).toBe(initialHp);
  });

  test('Archer shoots hero when within 3 hops and does not move', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport hero to (8,9) — exactly 3 hops from Archer at (8,12)
    await teleportHero(page, 8, 9);

    const initialHp = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(initialHp).toBe(10);

    await clickEndTurn(page);
    await waitForAnimating(page, false);

    await page.screenshot({ path: 'test-results/s9-2-after-shot.png' });

    const archerPosAfter = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const archer = map.liveEnemies.find((e: any) => e.data.name === 'Archer');
      return { col: archer.col as number, row: archer.row as number };
    });

    // Archer must NOT have moved (shot instead)
    expect(archerPosAfter.col).toBe(8);
    expect(archerPosAfter.row).toBe(12);

    // Hero HP must have dropped by 1 or 2
    const hpAfter = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') as number;
    });
    expect(hpAfter).toBeLessThan(initialHp);
    expect(hpAfter).toBeGreaterThanOrEqual(initialHp - 2);
  });
});
