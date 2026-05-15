import Phaser from "phaser";
import { MapScene } from "./MapScene";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    // Skip title if URL has any query param (used by e2e tests via /?nointro).
    if (typeof window !== "undefined" && window.location.search.length > 1) {
      this.scene.start("MapScene");
      return;
    }

    this.cameras.main.setBackgroundColor("#0a0a0a");

    this.add
      .text(640, 220, "HEROES CLONE", { fontSize: "72px", color: "#ffcc44", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(640, 290, "v1.3 — turn-based hex strategy", { fontSize: "20px", color: "#888888" })
      .setOrigin(0.5);

    const hasSave = (() => {
      try {
        return localStorage.getItem("heroes-clone:save") !== null;
      } catch {
        return false;
      }
    })();

    let buttonY = 400;
    if (hasSave) {
      this.makeButton(640, buttonY, "Continue", "#44cc44", () => this.scene.start("MapScene"));
      buttonY += 70;
    }
    this.makeButton(640, buttonY, "New Game", "#ffcc44", () => {
      this.clearAllProgress();
      this.game.registry.remove("randomTerrain");
      this.game.registry.remove("randomEnemySpawns");
      this.game.registry.remove("randomPotions");
      this.game.registry.remove("randomScrolls");
      this.game.registry.remove("randomTowns");
      this.scene.start("MapScene", {});
    });
    buttonY += 70;
    this.makeButton(640, buttonY, "Random Game", "#88ccff", () => {
      this.clearAllProgress();
      const terrain = MapScene.generateRandomTerrain();
      const enemySpawns = MapScene.generateRandomEnemySpawns(terrain);
      const pickups = MapScene.generateRandomPickups(terrain, enemySpawns);
      const towns = MapScene.generateRandomTowns(terrain, enemySpawns, pickups);
      this.game.registry.set("randomTerrain", terrain);
      this.game.registry.set("randomEnemySpawns", enemySpawns);
      this.game.registry.set("randomPotions", pickups.potions);
      this.game.registry.set("randomScrolls", pickups.scrolls);
      this.game.registry.set("randomTowns", towns);
      this.scene.start("MapScene", {});
    });
    buttonY += 70;
    this.makeButton(640, buttonY, "About", "#888888", () => this.showAbout());

    // Difficulty toggle below About
    this.addDifficultyToggle(buttonY + 80);
  }

  private addDifficultyToggle(y: number): void {
    const current = (this.game.registry.get("difficulty") as "easy" | "normal" | "hard" | undefined) ?? "normal";
    const colorFor = (d: string) => d === "easy" ? "#44cc44" : d === "hard" ? "#cc4444" : "#ffcc44";
    const label = this.add
      .text(640 - 130, y, "Difficulty:", { fontSize: "16px", color: "#888888" })
      .setOrigin(1, 0.5);
    const display = this.add
      .text(640, y, current.toUpperCase(), { fontSize: "18px", color: colorFor(current), fontStyle: "bold" })
      .setOrigin(0.5);
    const cycleBtn = this.add
      .rectangle(640 + 110, y, 80, 30, 0x2a3a4a)
      .setStrokeStyle(1, 0x888888)
      .setOrigin(0.5)
      .setInteractive();
    this.add.text(640 + 110, y, "cycle", { fontSize: "14px", color: "#cccccc" }).setOrigin(0.5);
    cycleBtn.on("pointerover", () => cycleBtn.setFillStyle(0x4a6a8a));
    cycleBtn.on("pointerout", () => cycleBtn.setFillStyle(0x2a3a4a));
    cycleBtn.on("pointerdown", () => {
      const cur = (this.game.registry.get("difficulty") as string | undefined) ?? "normal";
      const next = cur === "easy" ? "normal" : cur === "normal" ? "hard" : "easy";
      this.game.registry.set("difficulty", next);
      display.setText(next.toUpperCase()).setColor(colorFor(next));
    });
    void label;
  }

  private clearAllProgress(): void {
    try {
      localStorage.removeItem("heroes-clone:save");
    } catch {
      /* ignore */
    }
    const game = this.game;
    game.registry.remove("defeatedEnemies");
    game.registry.remove("consumedPotions");
    game.registry.remove("consumedScrolls");
    game.registry.remove("heroHp");
    game.registry.remove("heroXp");
    game.registry.remove("heroLevel");
    game.registry.remove("heroArmy");
  }

  private makeButton(x: number, y: number, label: string, color: string, onClick: () => void): void {
    const rect = this.add
      .rectangle(x, y, 240, 50, 0x2a3a4a)
      .setStrokeStyle(2, Number(`0x${color.slice(1)}`))
      .setOrigin(0.5)
      .setInteractive();
    this.add.text(x, y, label, { fontSize: "22px", color }).setOrigin(0.5);
    rect.on("pointerover", () => rect.setFillStyle(0x4a6a8a));
    rect.on("pointerout", () => rect.setFillStyle(0x2a3a4a));
    rect.on("pointerdown", onClick);
  }

  private showAbout(): void {
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.85).setOrigin(0.5).setDepth(100);
    const text = this.add
      .text(
        640,
        360,
        "HEROES CLONE\n\nA tiny Heroes 3-style turn-based hex strategy game.\nBuilt as a slice-by-slice exercise in TypeScript + Phaser 3.\n\nClick anywhere to dismiss.",
        { fontSize: "18px", color: "#cccccc", align: "center", lineSpacing: 6 }
      )
      .setOrigin(0.5)
      .setDepth(101);
    overlay.setInteractive();
    overlay.on("pointerdown", () => {
      overlay.destroy();
      text.destroy();
    });
  }
}
