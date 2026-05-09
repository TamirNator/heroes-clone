import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

function hexBfsHops(
  page: any,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number
): Promise<number> {
  return page.evaluate(
    ({ fc, fr, tc, tr }: { fc: number; fr: number; tc: number; tr: number }) => {
      const COLS = 20, ROWS = 15;
      function neighbors(col: number, row: number) {
        const off: [number, number][] = row % 2 === 0
          ? [[-1,0],[1,0],[-1,-1],[0,-1],[-1,1],[0,1]]
          : [[-1,0],[1,0],[0,-1],[1,-1],[0,1],[1,1]];
        return off.map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
          .filter(({ col: c, row: r }) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
      }
      const visited = new Set<string>();
      const queue: Array<{ col: number; row: number; d: number }> = [{ col: fc, row: fr, d: 0 }];
      visited.add(`${fc},${fr}`);
      while (queue.length > 0) {
        const { col, row, d } = queue.shift()!;
        if (col === tc && row === tr) return d;
        for (const nb of neighbors(col, row)) {
          const k = `${nb.col},${nb.row}`;
          if (!visited.has(k)) { visited.add(k); queue.push({ col: nb.col, row: nb.row, d: d + 1 }); }
        }
      }
      return -1;
    },
    { fc: fromCol, fr: fromRow, tc: toCol, tr: toRow }
  );
}

test.describe('S9.0 — fast enemy type (Wolves)', () => {
  test('Wolf moves 2 tiles per turn; Goblin moves 1 tile per turn', async ({ page }) => {
    await page.goto('/?nointro');
    await waitForScene(page, 'MapScene');

    // Read initial positions
    const initial = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const wolf = map.liveEnemies.find((e: any) => e.data.col === 5 && e.data.row === 11);
      const goblin = map.liveEnemies.find((e: any) => e.data.col === 4 && e.data.row === 4);
      return {
        wolfCol: wolf?.col as number,
        wolfRow: wolf?.row as number,
        goblinCol: goblin?.col as number,
        goblinRow: goblin?.row as number,
      };
    });

    expect(initial.wolfCol).toBe(5);
    expect(initial.wolfRow).toBe(11);
    expect(initial.goblinCol).toBe(4);
    expect(initial.goblinRow).toBe(4);

    // Click End Turn
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 1200, y: 68 } });

    // Wait for all enemy animations to complete
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      return map?.isAnimating === false;
    }, null, { timeout: 10000 });

    await page.screenshot({ path: 'test-results/s9-0-wolves-after-turn.png' });

    // Read new positions
    const after = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const wolf = map.liveEnemies.find((e: any) => e.data.col === 5 && e.data.row === 11);
      const goblin = map.liveEnemies.find((e: any) => e.data.col === 4 && e.data.row === 4);
      return {
        wolfCol: wolf?.col as number,
        wolfRow: wolf?.row as number,
        goblinCol: goblin?.col as number,
        goblinRow: goblin?.row as number,
      };
    });

    // Goblin (movesPerTurn=1) should have moved exactly 1 hop from its spawn (4,4)
    const goblinHops = await hexBfsHops(page, 4, 4, after.goblinCol, after.goblinRow);
    expect(goblinHops).toBe(1);

    // Wolf (movesPerTurn=2) should have moved exactly 2 hops from its spawn (5,11)
    const wolfHops = await hexBfsHops(page, 5, 11, after.wolfCol, after.wolfRow);
    expect(wolfHops).toBe(2);
  });
});
