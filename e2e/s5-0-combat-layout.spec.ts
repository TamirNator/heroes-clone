import { test, expect } from '@playwright/test';

test.describe('S5.0 — combat scene visual layout', () => {
  test('hero and enemy stacks visible with HP labels', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      if (!g) return false;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });

    // Teleport hero adjacent to enemy
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const targetCol = 4;
      const targetRow = 3;
      map.heroCol = targetCol;
      map.heroRow = targetRow;
      const x = map.startX + targetCol * map.colStep + (targetRow % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + targetRow * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    // Click enemy hex
    const enemyPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const sprite = map.enemySprite;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + sprite.x * scaleX, y: rect.top + sprite.y * scaleY };
    });

    await page.mouse.click(enemyPos.x, enemyPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'CombatScene');
    }, { timeout: 10000 });

    await page.screenshot({ path: 'test-results/s5-0-combat.png' });

    // Assert combat layout children
    const layout = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const children: any[] = combat.children.list;
      const arcFills = children.filter((c: any) => c.type === 'Arc').map((c: any) => c.fillColor);
      const texts = children.filter((c: any) => c.type === 'Text').map((c: any) => c.text as string);
      return { arcFills, texts };
    });

    expect(layout.arcFills).toContain(0xffcc44);
    expect(layout.arcFills).toContain(0xcc4444);
    expect(layout.texts.some(t => t.includes('HP: 10'))).toBe(true);
    expect(layout.texts.some(t => t.includes('HP: 5'))).toBe(true);
    expect(layout.texts.some(t => t.includes('Hero'))).toBe(true);
    expect(layout.texts.some(t => t.includes('Enemy'))).toBe(true);

    // Click Return button and confirm back to MapScene
    const returnPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat: any = g.scene.getScene('CombatScene');
      const btn = combat.children.list.filter((c: any) => c.type === 'Rectangle')[0];
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
    });

    await page.mouse.click(returnPos.x, returnPos.y);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      return g.scene.getScenes(true).some((s: any) => s.scene.key === 'MapScene');
    }, { timeout: 5000 });
  });
});
