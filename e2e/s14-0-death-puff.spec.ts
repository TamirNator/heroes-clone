import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S14.0 — unit-death puff animation', () => {
  test('killing 2 enemy units spawns 2 puff arcs that disappear after animation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Teleport hero adjacent to Troll at (15,11)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      map.heroCol = 14;
      map.heroRow = 11;
      const x = map.startX + 14 * map.colStep + (11 % 2 === 1 ? map.colStep / 2 : 0);
      const y = map.startY + 11 * map.rowStep;
      map.heroSprite.setPosition(x, y);
      map.remainingMoves = 5;
    });

    const trollPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const le = map.liveEnemies.find((e: any) => e.col === 15 && e.row === 11);
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + le.sprite.x * (rect.width / g.config.width),
        y: rect.top + le.sprite.y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(trollPos.x, trollPos.y);
    await waitForScene(page, 'CombatScene');

    // Pin hero damage to 4 (Troll hpPerUnit=2 → kills 2 units per hit), enemy deals 0
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 4;
      combat.rollEnemyDamage = () => 0;
    });

    // Snapshot baseline Arc count (permanent circles: 2 hero stacks + 1 enemy = 3)
    const baselineArcCount = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.children.list.filter((c: any) => c.type === 'Arc').length as number;
    });

    // Click Attack
    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 320 * (rect.width / g.config.width),
        y: rect.top + 530 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(attackPos.x, attackPos.y);

    // Wait until ≥2 puff arcs appear and capture the count atomically in the same call
    // Lunge peaks at ~100ms, puff1 spawns immediately, puff2 at +100ms — both alive until puff1 expires at +500ms
    const peakHandle = await page.waitForFunction((baseline: number) => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const cnt = (combat.children.list.filter((c: any) => c.type === 'Arc').length as number);
      return cnt >= baseline + 2 ? cnt : false;
    }, baselineArcCount, { timeout: 1000 });

    const peakArcCount = await peakHandle.jsonValue() as number;

    // Take screenshot mid-animation
    await page.screenshot({ path: 'test-results/s14-0-puffs.png' });

    expect(peakArcCount).toBeGreaterThanOrEqual(baselineArcCount + 2);

    // Wait for all puffs to complete (100ms stagger + 400ms tween + 200ms buffer = 700ms from now)
    await page.waitForFunction((baseline: number) => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return (combat.children.list.filter((c: any) => c.type === 'Arc').length as number) <= baseline;
    }, baselineArcCount, { timeout: 2000 });

    const finalArcCount = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.children.list.filter((c: any) => c.type === 'Arc').length as number;
    });
    expect(finalArcCount).toBe(baselineArcCount);
  });
});
