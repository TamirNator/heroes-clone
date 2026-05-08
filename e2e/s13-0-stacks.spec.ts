import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function clickAttackAndWait(page: any, waitMs: number) {
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
  await page.waitForTimeout(waitMs);
}

test.describe('S13.0 — stack-of-units representation in combat', () => {
  test('Troll stack labels update correctly through combat', async ({ page }) => {
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

    // Click Troll hex to trigger combat
    const trollPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const map = g.scene.getScene('MapScene') as any;
      const sprite = map.liveEnemies.find((e: any) => e.col === 15 && e.row === 11)?.sprite;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + sprite.x * (rect.width / g.config.width),
        y: rect.top + sprite.y * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(trollPos.x, trollPos.y);
    await waitForScene(page, 'CombatScene');

    // Verify initial stack labels: Troll stackCount=4, hpPerUnit=2; hero HP=10
    const initialEnemyLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyStackLabel.text as string;
    });
    expect(initialEnemyLabel).toBe('Troll  x4');

    const initialHeroLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroStackLabel.text as string;
    });
    expect(initialHeroLabel).toBe('Hero  x10');

    await page.screenshot({ path: 'test-results/s13-0-initial-stacks.png' });

    // Pin damage: hero hits for 3 (Troll HP 8→5, units ceil(5/2)=3), Troll hits for 1 (hero 10→9)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 3;
      combat.rollEnemyDamage = () => 1;
    });

    // Round 1: click Attack, wait for lunge+retaliation to complete (~800ms total)
    await clickAttackAndWait(page, 800);

    // Wait for both labels to update
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyStackLabel?.text === 'Troll  x3' && combat.heroStackLabel?.text === 'Hero  x9';
    }, null, { timeout: 3000 });

    const afterRound1EnemyLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyStackLabel.text as string;
    });
    expect(afterRound1EnemyLabel).toBe('Troll  x3'); // ceil(5/2) = 3

    const afterRound1HeroLabel = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroStackLabel.text as string;
    });
    expect(afterRound1HeroLabel).toBe('Hero  x9');

    await page.screenshot({ path: 'test-results/s13-0-mid-fight.png' });

    // Round 2: Troll HP 5→2, units ceil(2/2)=1; hero 9→8
    await clickAttackAndWait(page, 800);

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyStackLabel?.text === 'Troll  x1' && combat.heroStackLabel?.text === 'Hero  x8';
    }, null, { timeout: 3000 });

    expect(await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.scene.getScene('CombatScene') as any).enemyStackLabel.text as string;
    })).toBe('Troll  x1');

    expect(await page.evaluate(() => {
      const g = (window as any).__game;
      return (g.scene.getScene('CombatScene') as any).heroStackLabel.text as string;
    })).toBe('Hero  x8');

    // Round 3: Troll HP 2→0 → VICTORY
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

    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      const texts: string[] = combat.children.list
        .filter((c: any) => c.type === 'Text')
        .map((c: any) => c.text as string);
      return texts.some(t => t === 'VICTORY!');
    }, null, { timeout: 3000 });
  });
});
