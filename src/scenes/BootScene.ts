import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.add
      .text(640, 360, "Heroes Clone v0.1", {
        color: "#ffffff",
        fontSize: "32px",
      })
      .setOrigin(0.5);
  }
}
