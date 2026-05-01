import Phaser from "phaser";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const HOVER_FILL = 0x4a6a8a;
const STROKE_COLOR = 0x556677;
const HERO_FILL = 0xffcc44;
const HERO_STROKE = 0x222222;

export class MapScene extends Phaser.Scene {
  private heroCol = 0;
  private heroRow = 0;
  private heroSprite!: Phaser.GameObjects.Arc;
  private hexR = 0;
  private colStep = 0;
  private rowStep = 0;
  private startX = 0;
  private startY = 0;

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

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x: cx, y: cy } = this.hexCenter(col, row);
        const points = this.hexPoints(cx, cy, this.hexR);

        const poly = this.add.polygon(0, 0, points, DEFAULT_FILL);
        poly.setStrokeStyle(1.5, STROKE_COLOR);
        poly.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains
        );

        poly.on("pointerover", () => poly.setFillStyle(HOVER_FILL));
        poly.on("pointerout", () => poly.setFillStyle(DEFAULT_FILL));
        poly.on("pointerdown", () => this.moveHeroTo(col, row));
      }
    }

    const { x, y } = this.hexCenter(0, 0);
    this.heroSprite = this.add
      .circle(x, y, this.hexR * 0.45, HERO_FILL)
      .setStrokeStyle(2, HERO_STROKE)
      .setDepth(10);
  }

  private hexCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.startX + col * this.colStep + (row % 2 === 1 ? this.colStep / 2 : 0),
      y: this.startY + row * this.rowStep,
    };
  }

  private moveHeroTo(col: number, row: number): void {
    this.heroCol = col;
    this.heroRow = row;
    const { x, y } = this.hexCenter(col, row);
    this.heroSprite.setPosition(x, y);
  }

  private hexPoints(cx: number, cy: number, r: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      pts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    return pts;
  }
}
