import Phaser from "phaser";

const HERO_HP = 10;
const ENEMY_HP = 5;

export class CombatScene extends Phaser.Scene {
  constructor() {
    super("CombatScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#1a0a0a");

    // Hero stack (left)
    this.add.text(320, 280, "Hero", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);
    this.add.circle(320, 360, 50, 0xffcc44).setStrokeStyle(2, 0x222222);
    this.add.text(320, 440, `HP: ${HERO_HP}`, { fontSize: "24px", color: "#ffcc44" }).setOrigin(0.5);

    // Enemy stack (right)
    this.add.text(960, 280, "Enemy", { fontSize: "20px", color: "#cc4444" }).setOrigin(0.5);
    this.add.circle(960, 360, 50, 0xcc4444).setStrokeStyle(2, 0x222222);
    this.add.text(960, 440, `HP: ${ENEMY_HP}`, { fontSize: "24px", color: "#cc4444" }).setOrigin(0.5);

    // VS
    this.add.text(640, 360, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);

    // Return button — top-left to avoid colliding with combat layout
    const btn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    btn.on("pointerover", () => btn.setFillStyle(0x4a6a8a));
    btn.on("pointerout", () => btn.setFillStyle(0x2a3a4a));
    btn.on("pointerdown", () => this.scene.start("MapScene", { defeated: true, heroCol: 4, heroRow: 4 }));
  }
}
