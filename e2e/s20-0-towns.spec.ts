import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S20.0 — towns', () => {
  test('walking onto a town tile fully heals all hero stacks', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Damage both hero stacks then teleport adjacent to town at (10, 12)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const army = map.getHeroArmy();
      army[0].currentHp = 5; // Swordsmen down from 20 → 5
      army[1].currentHp = 2; // Archers down from 8 → 2
      g.registry.set('heroArmy', army);
      g.registry.set('heroHp', 7);

      map.heroCol = 10;
      map.heroRow = 11;
      const x = map.startX + 10 * map.colStep + (11 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 11 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Compute town hex viewport coords and click
    const townPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const x = map.startX + 10 * map.colStep + (12 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 12 * map.rowStep;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + x * (rect.width / g.config.width),
        y: rect.top + y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(townPos.x, townPos.y);

    // Wait until heroHp climbs back to full (28)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.registry.get('heroHp') === 28;
    }, undefined, { timeout: 3000 });

    const army = await page.evaluate(() => {
      const g = (window as any).__game;
      return g.registry.get('heroArmy') as Array<{ currentHp: number; count: number; hpPerUnit: number }>;
    });
    expect(army[0]!.currentHp).toBe(army[0]!.count * army[0]!.hpPerUnit); // 20
    expect(army[1]!.currentHp).toBe(army[1]!.count * army[1]!.hpPerUnit); // 8
  });
});
