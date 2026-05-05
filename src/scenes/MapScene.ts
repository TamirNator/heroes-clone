import Phaser from "phaser";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const STROKE_COLOR = 0x556677;
const HERO_FILL = 0xffcc44;
const HERO_STROKE = 0x222222;
const MOVEMENT_PER_TURN = 5;
const SAVE_KEY = "heroes-clone:save";

type Terrain = "grass" | "forest" | "water";
const TERRAIN_FILL: Record<Terrain, number> = {
  grass: 0x2a3a4a,
  forest: 0x2d4a2d,
  water: 0x1a3a5a,
};
const TERRAIN_HOVER: Record<Terrain, number> = {
  grass: 0x4a6a8a,
  forest: 0x4a6a4a,
  water: 0x3a5a7a,
};
const TERRAIN_OVERRIDES: Record<string, Terrain> = {
  "6,3": "water", "7,3": "water", "6,4": "water", "7,4": "water",
  "13,5": "water", "13,6": "water", "13,7": "water", "13,8": "water",
  "2,2": "forest", "3,2": "forest", "2,3": "forest",
  "8,9": "forest", "9,9": "forest", "8,10": "forest", "9,10": "forest",
  "16,3": "forest", "17,3": "forest", "16,4": "forest",
};
const TERRAIN_COST: Record<Terrain, number> = {
  grass: 1,
  forest: 2,
  water: Infinity,
};

type Enemy = { col: number; row: number; name: string; hp: number; damageMin: number; damageMax: number };
const ENEMIES: readonly Enemy[] = [
  { col: 4, row: 4, name: "Goblin", hp: 3, damageMin: 1, damageMax: 1 },
  { col: 10, row: 7, name: "Orc", hp: 5, damageMin: 1, damageMax: 2 },
  { col: 15, row: 11, name: "Troll", hp: 8, damageMin: 2, damageMax: 3 },
];

type Hex = { col: number; row: number };

type LiveEnemy = {
  col: number;
  row: number;
  data: Enemy;
  sprite: Phaser.GameObjects.Arc;
};

type SaveData = {
  defeated: string[];
  heroCol: number;
  heroRow: number;
  remainingMoves: number;
};

export class MapScene extends Phaser.Scene {
  private heroCol = 0;
  private heroRow = 0;
  private heroSprite!: Phaser.GameObjects.Arc;
  private hexR = 0;
  private colStep = 0;
  private rowStep = 0;
  private startX = 0;
  private startY = 0;
  private remainingMoves = MOVEMENT_PER_TURN;
  isAnimating = false;
  private movesText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Rectangle;
  private resetBtn!: Phaser.GameObjects.Rectangle;
  liveEnemies: LiveEnemy[] = [];
  public lastPath: Hex[] = [];
  private gameWon = false;
  private initData: {
    defeatedCol?: number;
    defeatedRow?: number;
    heroCol?: number;
    heroRow?: number;
  } = {};

  constructor() {
    super("MapScene");
  }

  init(data: { defeatedCol?: number; defeatedRow?: number; heroCol?: number; heroRow?: number }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.isAnimating = false;
    this.liveEnemies = [];
    this.gameWon = false;

    // Ensure registry exists.
    if (!this.registry.has("defeatedEnemies")) {
      this.registry.set("defeatedEnemies", new Set<string>());
    }

    // Detect whether we arrived here from a scene transition (post-combat data) or a fresh/reset start.
    const isSceneTransition = this.initData.heroCol !== undefined || this.initData.defeatedCol !== undefined;

    if (isSceneTransition) {
      this.heroCol = this.initData.heroCol ?? 0;
      this.heroRow = this.initData.heroRow ?? 0;
      this.remainingMoves = MOVEMENT_PER_TURN;
      if (this.initData.defeatedCol !== undefined && this.initData.defeatedRow !== undefined) {
        (this.registry.get("defeatedEnemies") as Set<string>).add(
          `${this.initData.defeatedCol},${this.initData.defeatedRow}`
        );
      }
      this.saveProgress();
    } else {
      // Fresh page load or post-Reset/NewGame (save is already cleared).
      const save = this.loadProgress();
      if (save) {
        this.heroCol = save.heroCol;
        this.heroRow = save.heroRow;
        this.remainingMoves = save.remainingMoves;
        const defeatedSet = this.registry.get("defeatedEnemies") as Set<string>;
        defeatedSet.clear();
        for (const key of save.defeated) {
          defeatedSet.add(key);
        }
      } else {
        this.heroCol = 0;
        this.heroRow = 0;
        this.remainingMoves = MOVEMENT_PER_TURN;
      }
    }

    const margin = 20;
    const rFromW = (1280 - 2 * margin) / ((COLS + 0.5) * Math.sqrt(3));
    const rFromH = (720 - 2 * margin) / (1.5 * ROWS + 0.5);
    this.hexR = Math.min(rFromW, rFromH);

    this.colStep = Math.sqrt(3) * this.hexR;
    this.rowStep = 1.5 * this.hexR;

    const gridW = (COLS + 0.5) * this.colStep;
    const gridH = (1.5 * ROWS + 0.5) * this.hexR;
    this.startX = (1280 - gridW) / 2 + this.colStep / 2;
    this.startY = (720 - gridH) / 2 + this.hexR;

    const points = this.hexPointsRelative(this.hexR);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x: cx, y: cy } = this.hexCenter(col, row);

        const terrain = this.terrainAt(col, row);
        const fill = TERRAIN_FILL[terrain];
        const hoverFill = TERRAIN_HOVER[terrain];

        const poly = this.add.polygon(cx, cy, points, fill);
        poly.setOrigin(0);
        poly.setStrokeStyle(1.5, STROKE_COLOR);
        poly.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains
        );

        poly.on("pointerover", () => poly.setFillStyle(hoverFill));
        poly.on("pointerout", () => poly.setFillStyle(fill));
        poly.on("pointerdown", () => this.onHexClicked(col, row));
      }
    }

    const { x, y } = this.hexCenter(this.heroCol, this.heroRow);
    this.heroSprite = this.add
      .circle(x, y, this.hexR * 0.45, HERO_FILL)
      .setStrokeStyle(2, HERO_STROKE)
      .setDepth(10);

    for (const enemy of ENEMIES) {
      if (this.isDefeated(enemy.col, enemy.row)) continue;
      const { x: ex, y: ey } = this.hexCenter(enemy.col, enemy.row);
      const sprite = this.add
        .circle(ex, ey, this.hexR * 0.45, 0xcc4444)
        .setStrokeStyle(2, 0x222222)
        .setDepth(10);
      this.liveEnemies.push({ col: enemy.col, row: enemy.row, data: enemy, sprite });
    }

    const defeated = this.registry.get("defeatedEnemies") as Set<string>;
    if (defeated.size >= ENEMIES.length) {
      this.renderWinOverlay();
    }

    this.movesText = this.add
      .text(1280 - 20, 20, `Moves: ${this.remainingMoves}`, {
        fontSize: "20px",
        color: "#ffcc44",
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.endTurnBtn = this.add
      .rectangle(1280 - 20, 50, 120, 36, DEFAULT_FILL)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();

    this.add
      .text(1280 - 20 - 60, 50 + 18, "End Turn", {
        fontSize: "18px",
        color: "#ffcc44",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(21);

    this.endTurnBtn.on("pointerover", () => {
      if (!this.isAnimating) this.endTurnBtn.setFillStyle(TERRAIN_HOVER.grass);
    });
    this.endTurnBtn.on("pointerout", () => {
      this.endTurnBtn.setFillStyle(DEFAULT_FILL);
    });
    this.endTurnBtn.on("pointerdown", () => {
      if (!this.isAnimating && !this.gameWon) this.endTurn();
    });

    // Reset button — red-stroked, destructive action
    this.resetBtn = this.add
      .rectangle(1280 - 20, 110, 100, 30, DEFAULT_FILL)
      .setStrokeStyle(2, 0xcc4444)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();

    this.add
      .text(1280 - 20 - 50, 110 + 15, "Reset", {
        fontSize: "14px",
        color: "#cc4444",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(21);

    this.resetBtn.on("pointerover", () => {
      if (!this.isAnimating && !this.gameWon) this.resetBtn.setFillStyle(TERRAIN_HOVER.grass);
    });
    this.resetBtn.on("pointerout", () => {
      this.resetBtn.setFillStyle(DEFAULT_FILL);
    });
    this.resetBtn.on("pointerdown", () => {
      if (!this.isAnimating && !this.gameWon) {
        this.clearProgress();
        (this.registry.get("defeatedEnemies") as Set<string>).clear();
        this.scene.start("MapScene", {});
      }
    });
  }

  private renderWinOverlay(): void {
    this.gameWon = true;

    this.add.rectangle(640, 360, 1280, 720, 0x000000).setAlpha(0.7).setDepth(100);
    this.add.text(640, 300, "GAME WON!", { fontSize: "64px", color: "#44cc44" }).setOrigin(0.5).setDepth(101);
    this.add.text(640, 370, "All enemies defeated", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5).setDepth(101);

    const newGameBtn = this.add
      .rectangle(640, 460, 200, 50, 0x2a3a4a)
      .setStrokeStyle(2, 0x44cc44)
      .setDepth(101)
      .setInteractive();
    this.add.text(640, 460, "New Game", { fontSize: "22px", color: "#44cc44" }).setOrigin(0.5).setDepth(102);

    newGameBtn.on("pointerover", () => newGameBtn.setFillStyle(0x4a6a8a));
    newGameBtn.on("pointerout", () => newGameBtn.setFillStyle(0x2a3a4a));
    newGameBtn.on("pointerdown", () => {
      this.clearProgress();
      (this.registry.get("defeatedEnemies") as Set<string>).clear();
      this.scene.start("MapScene", {});
    });
  }

  private isDefeated(col: number, row: number): boolean {
    return (this.registry.get("defeatedEnemies") as Set<string>).has(`${col},${row}`);
  }

  private saveProgress(): void {
    const defeatedSet = this.registry.get("defeatedEnemies") as Set<string>;
    const save: SaveData = {
      defeated: Array.from(defeatedSet),
      heroCol: this.heroCol,
      heroRow: this.heroRow,
      remainingMoves: this.remainingMoves,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_e) {
      // localStorage unavailable (private mode, etc.) — fail silent
    }
  }

  private loadProgress(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SaveData;
    } catch (_e) {
      return null;
    }
  }

  private clearProgress(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_e) {
      // ignore
    }
  }

  private endTurn(): void {
    this.remainingMoves = MOVEMENT_PER_TURN;
    this.movesText.setText(`Moves: ${this.remainingMoves}`);
    this.runEnemyTurn();
  }

  private runEnemyTurn(): void {
    this.isAnimating = true;
    this.endTurnBtn.setAlpha(0.5);
    this.runEnemyStep(0);
  }

  private runEnemyStep(index: number): void {
    if (index >= this.liveEnemies.length) {
      this.isAnimating = false;
      this.endTurnBtn.setAlpha(1);
      this.saveProgress();
      return;
    }

    const enemy = this.liveEnemies[index]!;
    const path = this.dijkstraPath(enemy.col, enemy.row, this.heroCol, this.heroRow);

    if (path.length === 0) {
      this.runEnemyStep(index + 1);
      return;
    }

    const nextStep = path[0]!;
    const { x, y } = this.hexCenter(nextStep.col, nextStep.row);

    this.tweens.add({
      targets: enemy.sprite,
      x,
      y,
      duration: 150,
      ease: "Linear",
      onComplete: () => {
        enemy.col = nextStep.col;
        enemy.row = nextStep.row;

        if (enemy.col === this.heroCol && enemy.row === this.heroRow) {
          this.isAnimating = false;
          this.scene.start("CombatScene", {
            enemyCol: enemy.col,
            enemyRow: enemy.row,
            originalCol: enemy.data.col,
            originalRow: enemy.data.row,
            enemyName: enemy.data.name,
            enemyHp: enemy.data.hp,
            enemyDamageMin: enemy.data.damageMin,
            enemyDamageMax: enemy.data.damageMax,
          });
          return;
        }

        this.runEnemyStep(index + 1);
      },
    });
  }

  private onHexClicked(col: number, row: number): void {
    if (this.isAnimating || this.remainingMoves === 0 || this.gameWon) return;
    if (col === this.heroCol && row === this.heroRow) return;

    const path = this.dijkstraPath(this.heroCol, this.heroRow, col, row);
    if (path.length === 0) return;

    this.lastPath = path;
    const steps = this.truncatePathToBudget(path, this.remainingMoves);
    this.isAnimating = true;
    this.endTurnBtn.setAlpha(0.5);
    this.animatePath(steps, 0);
  }

  private animatePath(steps: Hex[], index: number): void {
    if (index >= steps.length) {
      this.isAnimating = false;
      this.endTurnBtn.setAlpha(1);
      const le = this.liveEnemies.find(e => e.col === this.heroCol && e.row === this.heroRow);
      if (le) {
        this.scene.start("CombatScene", {
          enemyCol: le.col,
          enemyRow: le.row,
          originalCol: le.data.col,
          originalRow: le.data.row,
          enemyName: le.data.name,
          enemyHp: le.data.hp,
          enemyDamageMin: le.data.damageMin,
          enemyDamageMax: le.data.damageMax,
        });
      } else {
        this.saveProgress();
      }
      return;
    }
    const { col, row } = steps[index]!;
    const { x, y } = this.hexCenter(col, row);
    this.tweens.add({
      targets: this.heroSprite,
      x,
      y,
      duration: 150,
      ease: "Linear",
      onComplete: () => {
        this.heroCol = col;
        this.heroRow = row;
        this.remainingMoves -= TERRAIN_COST[this.terrainAt(col, row)];
        this.movesText.setText(`Moves: ${this.remainingMoves}`);
        this.animatePath(steps, index + 1);
      },
    });
  }

  private terrainAt(col: number, row: number): Terrain {
    return TERRAIN_OVERRIDES[`${col},${row}`] ?? "grass";
  }

  private isPassable(col: number, row: number): boolean {
    return this.terrainAt(col, row) !== "water";
  }

  private dijkstraPath(
    fromCol: number,
    fromRow: number,
    toCol: number,
    toRow: number
  ): Hex[] {
    if (!this.isPassable(toCol, toRow)) return [];
    const dist = new Map<string, number>();
    const prev = new Map<string, Hex>();
    const startKey = `${fromCol},${fromRow}`;
    dist.set(startKey, 0);
    const queue: Array<{ key: string; col: number; row: number; d: number }> = [
      { key: startKey, col: fromCol, row: fromRow, d: 0 },
    ];
    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const u = queue.shift()!;
      if (u.col === toCol && u.row === toRow) break;
      if (u.d > (dist.get(u.key) ?? Infinity)) continue;
      for (const nb of this.hexNeighbors(u.col, u.row)) {
        if (!this.isPassable(nb.col, nb.row)) continue;
        const cost = TERRAIN_COST[this.terrainAt(nb.col, nb.row)];
        const nk = `${nb.col},${nb.row}`;
        const newD = u.d + cost;
        if (newD < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, newD);
          prev.set(nk, { col: u.col, row: u.row });
          queue.push({ key: nk, col: nb.col, row: nb.row, d: newD });
        }
      }
    }
    const target = `${toCol},${toRow}`;
    if (!prev.has(target) && startKey !== target) return [];
    const path: Hex[] = [];
    let cur: Hex = { col: toCol, row: toRow };
    while (`${cur.col},${cur.row}` !== startKey) {
      path.unshift(cur);
      cur = prev.get(`${cur.col},${cur.row}`)!;
    }
    return path;
  }

  private truncatePathToBudget(path: Hex[], budget: number): Hex[] {
    const taken: Hex[] = [];
    let spent = 0;
    for (const step of path) {
      const cost = TERRAIN_COST[this.terrainAt(step.col, step.row)];
      if (spent + cost > budget) break;
      spent += cost;
      taken.push(step);
    }
    return taken;
  }

  private hexNeighbors(col: number, row: number): Hex[] {
    const offsets: [number, number][] =
      row % 2 === 0
        ? [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
        : [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];
    return offsets
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter(({ col: c, row: r }) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
  }

  private hexCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.startX + col * this.colStep + (row % 2 === 1 ? this.colStep / 2 : 0),
      y: this.startY + row * this.rowStep,
    };
  }

  private hexPointsRelative(r: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      pts.push(r * Math.cos(angle), r * Math.sin(angle));
    }
    return pts;
  }
}
