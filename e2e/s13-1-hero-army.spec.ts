import { test, expect } from '@playwright/test';

async function waitForScene(page: any, key: string, timeout = 15000) {
  await page.waitForFunction((k: string) => {
    const g = (window as any).__game;
    return g?.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, key, { timeout });
}

async function triggerGoblinCombat(page: any) {
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
}

test.describe('S13.1 — hero has two unit stacks', () => {
  test('initial army: two stacks with correct HP and names', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    await triggerGoblinCombat(page);

    // Verify heroArmy has two stacks with correct initial state
    const army = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroArmy as Array<{ name: string; count: number; hpPerUnit: number; currentHp: number }>;
    });

    expect(army.length).toBe(2);
    expect(army[0]!.name).toBe('Swordsmen');
    expect(army[0]!.count).toBe(5);
    expect(army[0]!.currentHp).toBe(20); // 5×4
    expect(army[1]!.name).toBe('Archers');
    expect(army[1]!.count).toBe(4);
    expect(army[1]!.currentHp).toBe(8); // 4×2

    await page.screenshot({ path: 'test-results/s13-1-two-stacks.png' });
  });

  test('active stack toggle: click Archers circle to select it', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    await triggerGoblinCombat(page);

    // Default active = Swordsmen (index 0)
    const initialActive = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.activeStackIndex as number;
    });
    expect(initialActive).toBe(0);

    // Click the Archers circle (at x=400, y=360 in game coords)
    const archersPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 400 * (rect.width / g.config.width),
        y: rect.top + 360 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(archersPos.x, archersPos.y);

    // Verify active stack changed to 1 (Archers)
    const afterActive = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.activeStackIndex as number;
    });
    expect(afterActive).toBe(1);
  });

  test('attack uses active stack damage; Archers active kills Goblin in one hit with pinned roll=3', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    await triggerGoblinCombat(page);

    // Switch active to Archers (dmgMin=2, dmgMax=4)
    const archersPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 400 * (rect.width / g.config.width),
        y: rect.top + 360 * (rect.height / g.config.height),
      };
    });
    await page.mouse.click(archersPos.x, archersPos.y);

    // Pin Archers roll to 3 (Goblin HP=3, one shot kill)
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 3;
      combat.rollEnemyDamage = () => 1;
    });

    // Click Attack — Goblin HP 3→0 → VICTORY
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

    const enemyHp = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.enemyHp as number;
    });
    expect(enemyHp).toBe(0);
  });

  test('enemy retaliation targets active stack and reduces its HP and count', async ({ page }) => {
    await page.goto('/?nointro');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForScene(page, 'MapScene');

    // Use Troll (HP=8, dmg 2-3) for longer fight
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

    // Pin: hero dmg=1 (to keep Troll alive), Troll dmg=5 (above hpPerUnit=4 → each hit kills a unit)
    // Swordsmen HP 20: after 1 hit (5 dmg) → 15 HP = ceil(15/4)=4 units
    // After 2 hits (5+5=10) → 10 HP = ceil(10/4)=3 units
    // After 3 hits → 5 HP = ceil(5/4)=2 units
    await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      combat.rollHeroDamage = () => 1;
      combat.rollEnemyDamage = () => 5;
    });

    const attackPos = await page.evaluate(() => {
      const g = (window as any).__game;
      const cvs: HTMLCanvasElement = g.canvas;
      const rect = cvs.getBoundingClientRect();
      return {
        x: rect.left + 320 * (rect.width / g.config.width),
        y: rect.top + 530 * (rect.height / g.config.height),
      };
    });

    // Round 1 — Swordsmen HP 20→15, count 5→4
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroArmy[0]?.currentHp === 15;
    }, null, { timeout: 3000 });

    const afterR1 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return {
        hp: combat.heroArmy[0].currentHp as number,
        label: combat.heroStackLabels[0].text as string,
      };
    });
    expect(afterR1.hp).toBe(15);
    expect(afterR1.label).toBe('Swordsmen  x4'); // ceil(15/4)=4

    // Round 2 — Swordsmen HP 15→10, count 4→3
    await page.mouse.click(attackPos.x, attackPos.y);
    await page.waitForFunction(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return combat.heroArmy[0]?.currentHp === 10;
    }, null, { timeout: 3000 });

    const afterR2 = await page.evaluate(() => {
      const g = (window as any).__game;
      const combat = g.scene.getScene('CombatScene') as any;
      return {
        hp: combat.heroArmy[0].currentHp as number,
        label: combat.heroStackLabels[0].text as string,
      };
    });
    expect(afterR2.hp).toBe(10);
    expect(afterR2.label).toBe('Swordsmen  x3'); // ceil(10/4)=3

    await page.screenshot({ path: 'test-results/s13-1-retaliation-damage.png' });
  });
});
