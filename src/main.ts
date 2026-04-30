import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

const config: Phaser.Types.Core.GameConfig = {
  width: 1280,
  height: 720,
  parent: "game",
  scene: [BootScene],
  backgroundColor: "#0a0a0a",
};

new Phaser.Game(config);
