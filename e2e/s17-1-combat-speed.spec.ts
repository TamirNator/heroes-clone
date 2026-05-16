import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S17.1 — combat speed slider', () => {
  test('clicking Speed cycles 1× → 2× → 4× → 1×', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport adjacent to Goblin
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

    // Initial speed
    const initial = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.combatSpeed as number;
    });
    expect(initial).toBe(1);

    // Click Speed button at (620, 530)
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 620, y: 530 } });
    const after1 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return { speed: combat.combatSpeed as number, label: combat.speedBtnText.text as string };
    });
    expect(after1.speed).toBe(2);
    expect(after1.label).toBe('Speed: 2×');

    // Click again → 4×
    await canvas.click({ position: { x: 620, y: 530 } });
    const after2 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.combatSpeed as number;
    });
    expect(after2).toBe(4);

    // Click again → MAX (100)
    await canvas.click({ position: { x: 620, y: 530 } });
    const after3 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return { speed: combat.combatSpeed as number, label: combat.speedBtnText.text as string };
    });
    expect(after3.speed).toBe(100);
    expect(after3.label).toBe('Speed: MAX');

    // Click again → back to 1×
    await canvas.click({ position: { x: 620, y: 530 } });
    const after4 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.combatSpeed as number;
    });
    expect(after4).toBe(1);
  });
});
