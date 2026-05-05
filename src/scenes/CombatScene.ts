import Phaser from "phaser";

const HERO_HP = 10;
const ENEMY_HP_DEFAULT = 5;
const HERO_DAMAGE_MIN = 1;
const HERO_DAMAGE_MAX = 3;

export class CombatScene extends Phaser.Scene {
  private heroHp = HERO_HP;
  private enemyHp = ENEMY_HP_DEFAULT;
  private enemyDamageMin = 1;
  private enemyDamageMax = 1;
  private combatOver = false;
  private heroHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private attackBtn!: Phaser.GameObjects.Rectangle;
  initData: {
    enemyCol?: number;
    enemyRow?: number;
    enemyName?: string;
    enemyHp?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
  } = {};

  public rollHeroDamage: () => number = () =>
    Phaser.Math.Between(HERO_DAMAGE_MIN, HERO_DAMAGE_MAX);
  public rollEnemyDamage: () => number = () =>
    Phaser.Math.Between(this.enemyDamageMin, this.enemyDamageMax);

  constructor() {
    super("CombatScene");
  }

  init(data: {
    enemyCol?: number;
    enemyRow?: number;
    enemyName?: string;
    enemyHp?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
  }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.heroHp = HERO_HP;
    this.enemyHp = this.initData.enemyHp ?? ENEMY_HP_DEFAULT;
    this.enemyDamageMin = this.initData.enemyDamageMin ?? 1;
    this.enemyDamageMax = this.initData.enemyDamageMax ?? 1;
    this.combatOver = false;
    this.rollHeroDamage = () => Phaser.Math.Between(HERO_DAMAGE_MIN, HERO_DAMAGE_MAX);
    this.rollEnemyDamage = () => Phaser.Math.Between(this.enemyDamageMin, this.enemyDamageMax);

    this.cameras.main.setBackgroundColor("#1a0a0a");

    // Hero stack (left)
    this.add.text(320, 280, "Hero", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);
    this.add.circle(320, 360, 50, 0xffcc44).setStrokeStyle(2, 0x222222);
    this.heroHpText = this.add.text(320, 440, `HP: ${this.heroHp}`, { fontSize: "24px", color: "#ffcc44" }).setOrigin(0.5);

    // Enemy stack (right)
    this.add.text(960, 280, this.initData.enemyName ?? "Enemy", { fontSize: "20px", color: "#cc4444" }).setOrigin(0.5);
    this.add.circle(960, 360, 50, 0xcc4444).setStrokeStyle(2, 0x222222);
    this.enemyHpText = this.add.text(960, 440, `HP: ${this.enemyHp}`, { fontSize: "24px", color: "#cc4444" }).setOrigin(0.5);

    // VS
    this.add.text(640, 360, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);

    // Return button — top-left, kept for debug/safety; passes enemy coords back so defeat is recorded.
    const returnBtn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    returnBtn.on("pointerover", () => returnBtn.setFillStyle(0x4a6a8a));
    returnBtn.on("pointerout", () => returnBtn.setFillStyle(0x2a3a4a));
    returnBtn.on("pointerdown", () => this.scene.start("MapScene", {
      defeatedCol: this.initData.enemyCol,
      defeatedRow: this.initData.enemyRow,
      heroCol: this.initData.enemyCol,
      heroRow: this.initData.enemyRow,
    }));

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

  private spawnDamageText(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, `-${amount}`, { fontSize: "28px", color: "#cc4444" }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 600, onComplete: () => text.destroy() });
  }

  private onAttack(): void {
    if (this.combatOver) return;

    const dmg = this.rollHeroDamage();
    this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.enemyHpText.setText(`HP: ${this.enemyHp}`);
    this.spawnDamageText(960, 400, dmg);

    if (this.enemyHp <= 0) {
      this.combatOver = true;
      this.attackBtn.setAlpha(0.5).disableInteractive();
      this.showOutcome(true);
    } else {
      this.time.delayedCall(400, () => this.enemyAttack());
    }
  }

  private enemyAttack(): void {
    const dmg = this.rollEnemyDamage();
    this.heroHp = Math.max(0, this.heroHp - dmg);
    this.heroHpText.setText(`HP: ${this.heroHp}`);
    this.spawnDamageText(320, 400, dmg);

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
        this.scene.start("MapScene", {
          defeatedCol: this.initData.enemyCol,
          defeatedRow: this.initData.enemyRow,
          heroCol: this.initData.enemyCol,
          heroRow: this.initData.enemyRow,
        });
      } else {
        this.scene.start("MapScene");
      }
    });
  }
}
