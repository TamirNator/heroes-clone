import Phaser from "phaser";

const HERO_HP = 10;
const ENEMY_HP_DEFAULT = 5;
const HERO_DAMAGE_MIN = 1;
const HERO_DAMAGE_MAX = 3;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 14;
const BAR_Y = 425;

export class CombatScene extends Phaser.Scene {
  private heroHp = HERO_HP;
  private enemyHp = ENEMY_HP_DEFAULT;
  private heroMaxHp = HERO_HP;
  private enemyMaxHp = ENEMY_HP_DEFAULT;
  private enemyDamageMin = 1;
  private enemyDamageMax = 1;
  private combatOver = false;
  private isCombatAnimating = false;
  private heroSprite!: Phaser.GameObjects.Arc;
  private enemySprite!: Phaser.GameObjects.Arc;
  private heroHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private heroBarFill!: Phaser.GameObjects.Rectangle;
  private enemyBarFill!: Phaser.GameObjects.Rectangle;
  private attackBtn!: Phaser.GameObjects.Rectangle;
  initData: {
    enemyCol?: number;
    enemyRow?: number;
    originalCol?: number;
    originalRow?: number;
    enemyName?: string;
    enemyHp?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
    heroHp?: number;
    heroDamageMin?: number;
    heroDamageMax?: number;
    xpReward?: number;
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
    originalCol?: number;
    originalRow?: number;
    enemyName?: string;
    enemyHp?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
    heroHp?: number;
    heroDamageMin?: number;
    heroDamageMax?: number;
    xpReward?: number;
  }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.heroHp = this.initData.heroHp ?? HERO_HP;
    this.heroMaxHp = HERO_HP;
    this.enemyHp = this.initData.enemyHp ?? ENEMY_HP_DEFAULT;
    this.enemyMaxHp = this.initData.enemyHp ?? ENEMY_HP_DEFAULT;
    this.enemyDamageMin = this.initData.enemyDamageMin ?? 1;
    this.enemyDamageMax = this.initData.enemyDamageMax ?? 1;
    this.combatOver = false;
    this.isCombatAnimating = false;
    const heroDmgMin = this.initData.heroDamageMin ?? HERO_DAMAGE_MIN;
    const heroDmgMax = this.initData.heroDamageMax ?? HERO_DAMAGE_MAX;
    this.rollHeroDamage = () => Phaser.Math.Between(heroDmgMin, heroDmgMax);
    this.rollEnemyDamage = () => Phaser.Math.Between(this.enemyDamageMin, this.enemyDamageMax);

    this.cameras.main.setBackgroundColor("#1a0a0a");

    // Hero stack (left)
    this.add.text(320, 280, "Hero", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);
    this.heroSprite = this.add.circle(320, 360, 50, 0xffcc44).setStrokeStyle(2, 0x222222);
    this.heroHpText = this.add.text(320, 455, `HP: ${this.heroHp}`, { fontSize: "24px", color: "#ffcc44" }).setOrigin(0.5);

    // Enemy stack (right)
    this.add.text(960, 280, this.initData.enemyName ?? "Enemy", { fontSize: "20px", color: "#cc4444" }).setOrigin(0.5);
    this.enemySprite = this.add.circle(960, 360, 50, 0xcc4444).setStrokeStyle(2, 0x222222);
    this.enemyHpText = this.add.text(960, 455, `HP: ${this.enemyHp}`, { fontSize: "24px", color: "#cc4444" }).setOrigin(0.5);

    // VS
    this.add.text(640, 360, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);

    // Return button — rects[0]; top-left; passes enemy coords back so defeat is recorded.
    const returnBtn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    returnBtn.on("pointerover", () => returnBtn.setFillStyle(0x4a6a8a));
    returnBtn.on("pointerout", () => returnBtn.setFillStyle(0x2a3a4a));
    returnBtn.on("pointerdown", () => this.scene.start("MapScene", {
      defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
      defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
      heroCol: this.initData.enemyCol,
      heroRow: this.initData.enemyRow,
      heroHp: this.heroHp,
    }));

    // Attack button — rects[1]; below hero stack.
    this.attackBtn = this.add
      .rectangle(320, 530, 140, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(320, 530, "Attack", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);

    this.attackBtn.on("pointerover", () => this.attackBtn.setFillStyle(0x4a6a8a));
    this.attackBtn.on("pointerout", () => this.attackBtn.setFillStyle(0x2a3a4a));
    this.attackBtn.on("pointerdown", () => this.onAttack());

    // HP bars — added after buttons so rects[0/1] remain Return/Attack for existing tests.
    // Hero bar: background then fill (rects[2], rects[3])
    this.add.rectangle(320, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0x222222)
      .setStrokeStyle(1, 0x555555)
      .setOrigin(0.5);
    this.heroBarFill = this.add.rectangle(320 - BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0x44cc44)
      .setOrigin(0, 0.5);

    // Enemy bar: background then fill (rects[4], rects[5])
    this.add.rectangle(960, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0x222222)
      .setStrokeStyle(1, 0x555555)
      .setOrigin(0.5);
    this.enemyBarFill = this.add.rectangle(960 - BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0xcc4444)
      .setOrigin(0, 0.5);
  }

  private spawnDamageText(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, `-${amount}`, { fontSize: "28px", color: "#cc4444" }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 600, onComplete: () => text.destroy() });
  }

  private shakeOnHit(target: "hero" | "enemy"): void {
    if (this.combatOver) return;
    const sprite = target === "hero" ? this.heroSprite : this.enemySprite;
    const origX = sprite.x;
    this.tweens.add({
      targets: sprite, x: origX - 6, duration: 50, ease: "Linear",
      onComplete: () => {
        this.tweens.add({
          targets: sprite, x: origX + 6, duration: 50, ease: "Linear",
          onComplete: () => {
            this.tweens.add({
              targets: sprite, x: origX - 4, duration: 50, ease: "Linear",
              onComplete: () => {
                this.tweens.add({ targets: sprite, x: origX, duration: 50, ease: "Linear" });
              },
            });
          },
        });
      },
    });
  }

  private lungeAttack(attacker: "hero" | "enemy", onPeak: () => void, onLungeComplete?: () => void): void {
    const sprite = attacker === "hero" ? this.heroSprite : this.enemySprite;
    const origX = sprite.x;
    const offsetX = attacker === "hero" ? 80 : -80;

    this.tweens.add({
      targets: sprite,
      x: origX + offsetX,
      duration: 100,
      ease: "Cubic.easeOut",
      onComplete: () => {
        onPeak();
        this.tweens.add({
          targets: sprite,
          x: origX,
          duration: 100,
          ease: "Cubic.easeIn",
          onComplete: () => {
            this.isCombatAnimating = false;
            onLungeComplete?.();
          },
        });
      },
    });
  }

  private onAttack(): void {
    if (this.combatOver || this.isCombatAnimating) return;
    this.isCombatAnimating = true;

    this.lungeAttack("hero", () => {
      const dmg = this.rollHeroDamage();
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      this.enemyHpText.setText(`HP: ${this.enemyHp}`);
      this.enemyBarFill.displayWidth = Math.max(0, (this.enemyHp / this.enemyMaxHp) * BAR_WIDTH);
      this.spawnDamageText(960, 400, dmg);
      this.shakeOnHit("enemy");

      if (this.enemyHp <= 0) {
        this.combatOver = true;
        this.attackBtn.setAlpha(0.5).disableInteractive();
        this.showOutcome(true);
      }
    }, () => {
      if (!this.combatOver) {
        this.time.delayedCall(400, () => this.enemyAttack());
      }
    });
  }

  private enemyAttack(): void {
    this.lungeAttack("enemy", () => {
      const dmg = this.rollEnemyDamage();
      this.heroHp = Math.max(0, this.heroHp - dmg);
      this.heroHpText.setText(`HP: ${this.heroHp}`);
      this.heroBarFill.displayWidth = Math.max(0, (this.heroHp / this.heroMaxHp) * BAR_WIDTH);
      this.spawnDamageText(320, 400, dmg);
      this.shakeOnHit("hero");

      if (this.heroHp <= 0) {
        this.combatOver = true;
        this.attackBtn.setAlpha(0.5).disableInteractive();
        this.showOutcome(false);
      }
    });
  }

  private showOutcome(victory: boolean): void {
    const text = victory ? "VICTORY!" : "DEFEAT";
    const color = victory ? "#44cc44" : "#cc4444";
    this.add.text(640, 600, text, { fontSize: "40px", color }).setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      if (victory) {
        this.scene.start("MapScene", {
          defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
          defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
          heroCol: this.initData.enemyCol,
          heroRow: this.initData.enemyRow,
          heroHp: this.heroHp,
          xpGained: this.initData.xpReward ?? 0,
        });
      } else {
        this.scene.start("MapScene", { heroHp: HERO_HP });
      }
    });
  }
}
