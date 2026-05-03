import Phaser from "phaser";

export class CombatScene extends Phaser.Scene {
  constructor() {
    super("CombatScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#1a0a0a");

    this.add
      .text(640, 280, "COMBAT", {
        fontSize: "64px",
        color: "#ffcc44",
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(640, 400, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setInteractive();

    this.add
      .text(640, 400, "Return to Map", {
        fontSize: "18px",
        color: "#ffcc44",
      })
      .setOrigin(0.5);

    btn.on("pointerover", () => btn.setFillStyle(0x4a6a8a));
    btn.on("pointerout", () => btn.setFillStyle(0x2a3a4a));
    btn.on("pointerdown", () => this.scene.start("MapScene"));
  }
}
