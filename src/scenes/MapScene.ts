import Phaser from "phaser";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const HOVER_FILL = 0x4a6a8a;
const STROKE_COLOR = 0x556677;

export class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  create(): void {
    const margin = 20;

    // Pointy-top: hexW = sqrt(3)*r, hexH = 2*r
    // Odd rows shift right by colStep/2 — bounding box is (COLS+0.5)*sqrt(3)*r × (1.5*ROWS+0.5)*r
    const rFromW = (1280 - 2 * margin) / ((COLS + 0.5) * Math.sqrt(3));
    const rFromH = (720 - 2 * margin) / (1.5 * ROWS + 0.5);
    const r = Math.min(rFromW, rFromH);

    const colStep = Math.sqrt(3) * r;
    const rowStep = 1.5 * r;

    const gridW = (COLS + 0.5) * colStep;
    const gridH = (1.5 * ROWS + 0.5) * r;

    const startX = (1280 - gridW) / 2 + colStep / 2;
    const startY = (720 - gridH) / 2 + r;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = startX + col * colStep + (row % 2 === 1 ? colStep / 2 : 0);
        const cy = startY + row * rowStep;

        const points = this.hexPoints(cx, cy, r);

        const poly = this.add.polygon(0, 0, points, DEFAULT_FILL);
        poly.setStrokeStyle(1.5, STROKE_COLOR);
        poly.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains
        );

        poly.on("pointerover", () => poly.setFillStyle(HOVER_FILL));
        poly.on("pointerout", () => poly.setFillStyle(DEFAULT_FILL));
      }
    }
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
