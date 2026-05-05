import Phaser from "phaser";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const HOVER_FILL = 0x4a6a8a;
const STROKE_COLOR = 0x556677;
const HERO_FILL = 0xffcc44;
const HERO_STROKE = 0x222222;
const MOVEMENT_PER_TURN = 5;

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
  liveEnemies: LiveEnemy[] = [];
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
    // Phaser reuses the same scene instance on scene.start(); field initializers don't re-run.
    this.heroCol = this.initData.heroCol ?? 0;
    this.heroRow = this.initData.heroRow ?? 0;
    this.remainingMoves = MOVEMENT_PER_TURN;
    this.isAnimating = false;
    this.liveEnemies = [];
    this.gameWon = false;

    // registry persists across scene.start calls — use it to track defeated enemies game-wide.
    if (!this.registry.has("defeatedEnemies")) {
      this.registry.set("defeatedEnemies", new Set<string>());
    }
    if (this.initData.defeatedCol !== undefined && this.initData.defeatedRow !== undefined) {
      (this.registry.get("defeatedEnemies") as Set<string>).add(
        `${this.initData.defeatedCol},${this.initData.defeatedRow}`
      );
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

        const poly = this.add.polygon(cx, cy, points, DEFAULT_FILL);
        poly.setOrigin(0);
        poly.setStrokeStyle(1.5, STROKE_COLOR);
        poly.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains
        );

        poly.on("pointerover", () => poly.setFillStyle(HOVER_FILL));
        poly.on("pointerout", () => poly.setFillStyle(DEFAULT_FILL));
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
      if (!this.isAnimating) this.endTurnBtn.setFillStyle(HOVER_FILL);
    });
    this.endTurnBtn.on("pointerout", () => {
      this.endTurnBtn.setFillStyle(DEFAULT_FILL);
    });
    this.endTurnBtn.on("pointerdown", () => {
      if (!this.isAnimating && !this.gameWon) this.endTurn();
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
      (this.registry.get("defeatedEnemies") as Set<string>).clear();
      this.scene.start("MapScene", {});
    });
  }

  private isDefeated(col: number, row: number): boolean {
    return (this.registry.get("defeatedEnemies") as Set<string>).has(`${col},${row}`);
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
      return;
    }

    const enemy = this.liveEnemies[index]!;
    const path = this.bfsPath(enemy.col, enemy.row, this.heroCol, this.heroRow);

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

    const path = this.bfsPath(this.heroCol, this.heroRow, col, row);
    if (path.length === 0) return;

    const steps = path.slice(0, this.remainingMoves);
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
        this.remainingMoves--;
        this.movesText.setText(`Moves: ${this.remainingMoves}`);
        this.animatePath(steps, index + 1);
      },
    });
  }

  private bfsPath(
    fromCol: number,
    fromRow: number,
    toCol: number,
    toRow: number
  ): Hex[] {
    const key = (c: number, r: number): string => `${c},${r}`;
    const visited = new Set<string>();
    const prev = new Map<string, Hex>();
    const queue: Hex[] = [{ col: fromCol, row: fromRow }];
    const startKey = key(fromCol, fromRow);
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.col === toCol && current.row === toRow) {
        const path: Hex[] = [];
        let node: Hex = current;
        while (key(node.col, node.row) !== startKey) {
          path.unshift(node);
          node = prev.get(key(node.col, node.row))!;
        }
        return path;
      }
      for (const nb of this.hexNeighbors(current.col, current.row)) {
        const nk = key(nb.col, nb.row);
        if (!visited.has(nk)) {
          visited.add(nk);
          prev.set(nk, current);
          queue.push(nb);
        }
      }
    }
    return [];
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
