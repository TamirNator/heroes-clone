import Phaser from "phaser";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const HOVER_FILL = 0x4a6a8a;
const STROKE_COLOR = 0x556677;
const HERO_FILL = 0xffcc44;
const HERO_STROKE = 0x222222;
const MOVEMENT_PER_TURN = 5;

type Hex = { col: number; row: number };

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
  private isAnimating = false;
  private movesText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("MapScene");
  }

  create(): void {
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

    // Points relative to (0,0); polygon is positioned at (cx,cy) with setOrigin(0) so
    // _displayOriginX/Y = 0 and vertices render at exactly (cx+px, cy+py) — visual center = (cx,cy).
    // Without setOrigin(0), default origin 0.5 makes _displayOriginX=hexW/2, _displayOriginY=r,
    // which shifts the visual center to (cx-hexW/2, cy-r), offsetting it from the hero.
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

    const { x, y } = this.hexCenter(0, 0);

    this.heroSprite = this.add
      .circle(x, y, this.hexR * 0.45, HERO_FILL)
      .setStrokeStyle(2, HERO_STROKE)
      .setDepth(10);

    this.movesText = this.add
      .text(1280 - 20, 20, `Moves: ${this.remainingMoves}`, {
        fontSize: "20px",
        color: "#ffcc44",
      })
      .setOrigin(1, 0)
      .setDepth(20);

    // Button anchored top-right: setOrigin(1,0) so x=1260 is the right edge, y=50 is the top.
    this.endTurnBtn = this.add
      .rectangle(1280 - 20, 50, 120, 36, DEFAULT_FILL)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();

    // Text centered inside the rectangle: x = right_edge - half_width, y = top + half_height
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
      if (!this.isAnimating) this.endTurn();
    });
  }

  private endTurn(): void {
    this.remainingMoves = MOVEMENT_PER_TURN;
    this.movesText.setText(`Moves: ${this.remainingMoves}`);
  }

  private onHexClicked(col: number, row: number): void {
    if (this.isAnimating || this.remainingMoves === 0) return;
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

  // Points around (0,0) in local space; used with setOrigin(0) so visual center == polygon position.
  private hexPointsRelative(r: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      pts.push(r * Math.cos(angle), r * Math.sin(angle));
    }
    return pts;
  }
}
