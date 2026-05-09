import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 10000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S7.2 — HP bars in CombatScene', () => {
  test('HP bars render at full width and shrink proportionally after attack', async ({ page }) => {
    await page.goto('/?nointro');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await waitForScene(page, 'MapScene');

    // Teleport hero adjacent to Troll at (15,11)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 15;
      map.heroRow = 10;
      const x = map.startX + 15 * map.colStep + (10 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 10 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    const trollPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const le = map.liveEnemies.find((e: any) => e.col === 15 && e.row === 11);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + le.sprite.x * scaleX, y: rect.top + le.sprite.y * scaleY };
    });

    await page.mouse.click(trollPos.x, trollPos.y);
    await waitForScene(page, 'CombatScene');

    // Pin rolls: hero=2, enemy=2
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 2;
      combat.rollEnemyDamage = () => 2;
    });

    // Read initial bar state
    const initialBars = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const rects = combat.children.list.filter((c: any) => c.type === 'Rectangle');
      const heroFill = rects.find((r: any) => r.fillColor === 0x44cc44);
      const enemyFill = rects.find((r: any) => r.fillColor === 0xcc4444);
      return {
        heroWidth: heroFill?.displayWidth as number,
        enemyWidth: enemyFill?.displayWidth as number,
        rectCount: rects.length as number,
      };
    });

    expect(initialBars.rectCount).toBeGreaterThanOrEqual(4);
    expect(initialBars.heroWidth).toBe(100); // hero stack bar is 100px wide
    expect(initialBars.enemyWidth).toBe(160);

    // Click Attack once (hero deals 2 to Troll HP 8 → 6)
    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      const scaleX = rect.width / g.config.width;
      const scaleY = rect.height / g.config.height;
      return { x: rect.left + 320 * scaleX, y: rect.top + 530 * scaleY };
    });

    await page.mouse.click(attackPos.x, attackPos.y);

    // Wait for retaliation to complete (Swordsmen takes 2 from Troll → HP 20→18; Troll HP 8→6)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'HP: 18/20') && texts.some(t => t === 'HP: 6');
    }, null, { timeout: 3000 });

    await page.screenshot({ path: 'test-results/s7-2-bars-after-attack.png' });

    const afterBars = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const rects = combat.children.list.filter((c: any) => c.type === 'Rectangle');
      const heroFill = rects.find((r: any) => r.fillColor === 0x44cc44);
      const enemyFill = rects.find((r: any) => r.fillColor === 0xcc4444);
      return {
        heroWidth: heroFill?.displayWidth as number,
        enemyWidth: enemyFill?.displayWidth as number,
      };
    });

    // Enemy bar: (8-2)/8 * 160 = 120
    expect(afterBars.enemyWidth).toBe(120);
    // Hero bar (Swordsmen): (20-2)/20 * 100 = 90
    expect(afterBars.heroWidth).toBe(90);
  });
});
