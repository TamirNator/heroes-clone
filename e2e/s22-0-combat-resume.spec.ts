import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

test.describe('S22.0 — combat resume across page reload', () => {
  test('mid-combat reload resumes in CombatScene with same enemyHp', async ({ page }) => {
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

    // Pin damage: hero=1 (Goblin survives), enemy=0
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 0;
    });

    // Click Attack once → Goblin HP 3 → 2
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

    // Wait for the round to end (combat-state save happens after enemyAttack lungeComplete)
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.roundNumber === 2;
    }, undefined, { timeout: 3000 });

    // Verify localStorage has inCombat
    const inCombat = await page.evaluate(() => {
      const raw = localStorage.getItem('heroes-clone:save');
      if (!raw) return null;
      const save = JSON.parse(raw);
      return save.inCombat;
    });
    expect(inCombat).toBeTruthy();
    expect(inCombat.enemyHp).toBe(2);
    expect(inCombat.enemyName).toBe('Goblin');

    // Reload to plain "/" (no nointro) — TitleScene should auto-resume into CombatScene
    await page.goto('/');
    await waitForScene(page, 'CombatScene', 5000);

    // Resumed CombatScene should have enemyHp=2
    const resumedHp = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp as number;
    });
    expect(resumedHp).toBe(2);
  });
});
