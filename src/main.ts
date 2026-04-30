import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MapScene } from "./scenes/MapScene";

const config: Phaser.Types.Core.GameConfig = {
  width: 1280,
  height: 720,
  parent: "game",
  scene: [MapScene, BootScene],
  backgroundColor: "#0a0a0a",
};

new Phaser.Game(config);
