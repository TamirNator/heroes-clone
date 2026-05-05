import Phaser from "phaser";

const HERO_HP = 10;
const ENEMY_HP = 5;
const HERO_DAMAGE = 2;
const ENEMY_DAMAGE = 1;

export class CombatScene extends Phaser.Scene {
  private heroHp = HERO_HP;
  private enemyHp = ENEMY_HP;
  private combatOver = false;
  private heroHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private attackBtn!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("CombatScene");
  }

  create(): void {
    this.heroHp = HERO_HP;
    this.enemyHp = ENEMY_HP;
    this.combatOver = false;

    this.cameras.main.setBackgroundColor("#1a0a0a");

    // Hero stack (left)
    this.add.text(320, 280, "Hero", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);
    this.add.circle(320, 360, 50, 0xffcc44).setStrokeStyle(2, 0x222222);
    this.heroHpText = this.add.text(320, 440, `HP: ${this.heroHp}`, { fontSize: "24px", color: "#ffcc44" }).setOrigin(0.5);

    // Enemy stack (right)
    this.add.text(960, 280, "Enemy", { fontSize: "20px", color: "#cc4444" }).setOrigin(0.5);
    this.add.circle(960, 360, 50, 0xcc4444).setStrokeStyle(2, 0x222222);
    this.enemyHpText = this.add.text(960, 440, `HP: ${this.enemyHp}`, { fontSize: "24px", color: "#cc4444" }).setOrigin(0.5);

    // VS
    this.add.text(640, 360, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);

    // Return button — top-left
    const returnBtn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    returnBtn.on("pointerover", () => returnBtn.setFillStyle(0x4a6a8a));
    returnBtn.on("pointerout", () => returnBtn.setFillStyle(0x2a3a4a));
    returnBtn.on("pointerdown", () => this.scene.start("MapScene", { defeated: true, heroCol: 4, heroRow: 4 }));

    // Attack button — below hero stack
    this.attackBtn = this.add
      .rectangle(320, 530, 140, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(320, 530, "Attack", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);

    this.attackBtn.on("pointerover", () => this.attackBtn.setFillStyle(0x4a6a8a));
    this.attackBtn.on("pointerout", () => this.attackBtn.setFillStyle(0x2a3a4a));
    this.attackBtn.on("pointerdown", () => this.onAttack());
  }

  private onAttack(): void {
    if (this.combatOver) return;

    this.enemyHp = Math.max(0, this.enemyHp - HERO_DAMAGE);
    this.enemyHpText.setText(`HP: ${this.enemyHp}`);

    if (this.enemyHp <= 0) {
      this.combatOver = true;
      this.attackBtn.setAlpha(0.5).disableInteractive();
      this.showOutcome(true);
    } else {
      this.time.delayedCall(400, () => this.enemyAttack());
    }
  }

  private enemyAttack(): void {
    this.heroHp = Math.max(0, this.heroHp - ENEMY_DAMAGE);
    this.heroHpText.setText(`HP: ${this.heroHp}`);

    if (this.heroHp <= 0) {
      this.combatOver = true;
      this.attackBtn.setAlpha(0.5).disableInteractive();
      this.showOutcome(false);
    }
  }

  private showOutcome(victory: boolean): void {
    const text = victory ? "VICTORY!" : "DEFEAT";
    const color = victory ? "#44cc44" : "#cc4444";
    this.add.text(640, 600, text, { fontSize: "40px", color }).setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      if (victory) {
        this.scene.start("MapScene", { defeated: true, heroCol: 4, heroRow: 4 });
      } else {
        this.scene.start("MapScene");
      }
    });
  }
}
