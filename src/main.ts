/// <reference types="vite/client" />
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MapScene } from "./scenes/MapScene";
import { CombatScene } from "./scenes/CombatScene";

const config: Phaser.Types.Core.GameConfig = {
  width: 1280,
  height: 720,
  parent: "game",
  scene: [MapScene, BootScene, CombatScene],
  backgroundColor: "#0a0a0a",
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
