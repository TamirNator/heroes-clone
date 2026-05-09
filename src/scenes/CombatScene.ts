import Phaser from "phaser";

type HeroStackState = {
  name: string;
  count: number;
  hpPerUnit: number;
  damageMin: number;
  damageMax: number;
  currentHp: number;
};

function unitsRemaining(currentHp: number, hpPerUnit: number): number {
  return Math.ceil(currentHp / hpPerUnit);
}

const HERO_HP = 10; // legacy defeat-signal constant
const ENEMY_HP_DEFAULT = 5;
const HERO_STACK_X = [240, 400] as const;
const HERO_STACK_FILLS = [0xffcc44, 0xddaa33] as const;
const HERO_BAR_WIDTH = 100;
const BAR_WIDTH = 160; // enemy bar
const BAR_HEIGHT = 14;
const BAR_Y = 425;

const DEFAULT_HERO_ARMY: HeroStackState[] = [
  { name: "Swordsmen", count: 5, hpPerUnit: 4, damageMin: 1, damageMax: 3, currentHp: 20 },
  { name: "Archers", count: 4, hpPerUnit: 2, damageMin: 2, damageMax: 4, currentHp: 8 },
];

export class CombatScene extends Phaser.Scene {
  public heroArmy: HeroStackState[] = [];
  private activeStackIndex = 0;
  private heroSprites: Phaser.GameObjects.Arc[] = [];
  private heroStackLabels: Phaser.GameObjects.Text[] = [];
  private heroHpTexts: Phaser.GameObjects.Text[] = [];
  private heroBarFills: Phaser.GameObjects.Rectangle[] = [];
  private enemyHp = ENEMY_HP_DEFAULT;
  private enemyMaxHp = ENEMY_HP_DEFAULT;
  private enemyDamageMin = 1;
  private enemyDamageMax = 1;
  private combatOver = false;
  private isCombatAnimating = false;
  private enemyHpPerUnit = 1;
  private enemyName = "Enemy";
  private enemyColor = 0xcc4444;
  private enemySprite!: Phaser.GameObjects.Arc;
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyStackLabel!: Phaser.GameObjects.Text;
  private enemyBarFill!: Phaser.GameObjects.Rectangle;
  private attackBtn!: Phaser.GameObjects.Rectangle;
  public logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;

  initData: {
    enemyCol?: number;
    enemyRow?: number;
    originalCol?: number;
    originalRow?: number;
    enemyName?: string;
    enemyHp?: number;
    enemyStackCount?: number;
    enemyHpPerUnit?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
    heroArmy?: HeroStackState[];
    xpReward?: number;
  } = {};

  // Back-compat getter: total hero HP across all stacks
  get heroHp(): number {
    return this.heroArmy.reduce((s, u) => s + u.currentHp, 0);
  }

  // Back-compat getter: returns active hero stack's sprite
  get heroSprite(): Phaser.GameObjects.Arc {
    return this.heroSprites[this.activeStackIndex]!;
  }

  // Back-compat getter: first hero stack label (used by s13-0 tests)
  get heroStackLabel(): Phaser.GameObjects.Text {
    return this.heroStackLabels[0]!;
  }

  public rollHeroDamage: () => number = () => {
    const stack = this.heroArmy[this.activeStackIndex];
    if (!stack) return 0;
    return Phaser.Math.Between(stack.damageMin, stack.damageMax);
  };
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
    enemyStackCount?: number;
    enemyHpPerUnit?: number;
    enemyDamageMin?: number;
    enemyDamageMax?: number;
    heroArmy?: HeroStackState[];
    xpReward?: number;
  }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.heroArmy = (this.initData.heroArmy ?? DEFAULT_HERO_ARMY).map(u => ({ ...u }));
    this.activeStackIndex = 0;
    this.heroSprites = [];
    this.heroStackLabels = [];
    this.heroHpTexts = [];
    this.heroBarFills = [];
    this.enemyHp = this.initData.enemyHp ?? ENEMY_HP_DEFAULT;
    this.enemyMaxHp = this.initData.enemyHp ?? ENEMY_HP_DEFAULT;
    this.enemyHpPerUnit = this.initData.enemyHpPerUnit ?? 1;
    this.enemyName = this.initData.enemyName ?? "Enemy";
    this.enemyDamageMin = this.initData.enemyDamageMin ?? 1;
    this.enemyDamageMax = this.initData.enemyDamageMax ?? 1;
    this.combatOver = false;
    this.isCombatAnimating = false;
    this.logLines = [];
    this.rollHeroDamage = () => {
      const stack = this.heroArmy[this.activeStackIndex];
      if (!stack) return 0;
      return Phaser.Math.Between(stack.damageMin, stack.damageMax);
    };
    this.rollEnemyDamage = () => Phaser.Math.Between(this.enemyDamageMin, this.enemyDamageMax);

    this.cameras.main.setBackgroundColor("#1a0a0a");

    // Hero stacks (left side, two stacks)
    for (let i = 0; i < this.heroArmy.length; i++) {
      const stack = this.heroArmy[i]!;
      const sx = HERO_STACK_X[i]!;
      const fill = HERO_STACK_FILLS[i] ?? 0xffcc44;
      const strokeW = i === this.activeStackIndex ? 4 : 2;
      const strokeColor = i === this.activeStackIndex ? 0xffff44 : 0x222222;

      const label = this.add
        .text(sx, 280, this.formatStackLabel(stack.name, unitsRemaining(stack.currentHp, stack.hpPerUnit)), {
          fontSize: "18px",
          color: "#ffcc44",
        })
        .setOrigin(0.5);
      this.heroStackLabels.push(label);

      const sprite = this.add
        .circle(sx, 360, 40, fill)
        .setStrokeStyle(strokeW, strokeColor)
        .setInteractive();
      this.heroSprites.push(sprite);

      const stackMax = stack.count * stack.hpPerUnit;
      const hpText = this.add
        .text(sx, 450, `HP: ${stack.currentHp}/${stackMax}`, { fontSize: "18px", color: "#ffcc44" })
        .setOrigin(0.5);
      this.heroHpTexts.push(hpText);

      const capturedI = i;
      sprite.on("pointerdown", () => this.selectStack(capturedI));
    }

    // Enemy stack (right)
    this.enemyStackLabel = this.add
      .text(960, 280, this.formatStackLabel(this.enemyName, unitsRemaining(this.enemyHp, this.enemyHpPerUnit)), {
        fontSize: "20px",
        color: "#cc4444",
      })
      .setOrigin(0.5);
    this.enemySprite = this.add.circle(960, 360, 50, 0xcc4444).setStrokeStyle(2, 0x222222);
    this.enemyHpText = this.add
      .text(960, 455, `HP: ${this.enemyHp}`, { fontSize: "24px", color: "#cc4444" })
      .setOrigin(0.5);

    // VS
    this.add.text(640, 360, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);

    // Return button — rects[0]
    const returnBtn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    returnBtn.on("pointerover", () => returnBtn.setFillStyle(0x4a6a8a));
    returnBtn.on("pointerout", () => returnBtn.setFillStyle(0x2a3a4a));
    returnBtn.on("pointerdown", () =>
      this.scene.start("MapScene", {
        defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
        defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
        heroCol: this.initData.enemyCol,
        heroRow: this.initData.enemyRow,
        heroArmy: this.heroArmy,
      })
    );

    // Attack button — rects[1]
    this.attackBtn = this.add
      .rectangle(320, 530, 140, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(320, 530, "Attack", { fontSize: "20px", color: "#ffcc44" }).setOrigin(0.5);

    this.attackBtn.on("pointerover", () => this.attackBtn.setFillStyle(0x4a6a8a));
    this.attackBtn.on("pointerout", () => this.attackBtn.setFillStyle(0x2a3a4a));
    this.attackBtn.on("pointerdown", () => this.onAttack());

    // Hero HP bars — one per stack (added after buttons so rects[0/1] remain Return/Attack)
    for (let i = 0; i < this.heroArmy.length; i++) {
      const stack = this.heroArmy[i]!;
      const sx = HERO_STACK_X[i]!;
      this.add
        .rectangle(sx, BAR_Y, HERO_BAR_WIDTH, 12, 0x222222)
        .setStrokeStyle(1, 0x555555)
        .setOrigin(0.5);
      const fill = this.add
        .rectangle(sx - HERO_BAR_WIDTH / 2, BAR_Y, HERO_BAR_WIDTH, 12, 0x44cc44)
        .setOrigin(0, 0.5);
      this.heroBarFills.push(fill);
      // Initialise bar width based on current HP
      const stackMax = stack.count * stack.hpPerUnit;
      fill.displayWidth = Math.max(0, (stack.currentHp / stackMax) * HERO_BAR_WIDTH);
    }

    // Enemy HP bar (rects[4], rects[5] relative to old layout — background + fill)
    this.add
      .rectangle(960, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0x222222)
      .setStrokeStyle(1, 0x555555)
      .setOrigin(0.5);
    this.enemyBarFill = this.add
      .rectangle(960 - BAR_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0xcc4444)
      .setOrigin(0, 0.5);

    // Combat log panel — bottom of canvas
    this.add
      .rectangle(640, 660, 1200, 120, 0x111111, 0.6)
      .setStrokeStyle(1, 0x444444)
      .setOrigin(0.5, 0.5)
      .setDepth(5);
    this.logText = this.add
      .text(60, 605, "", { fontSize: "14px", color: "#cccccc" })
      .setOrigin(0, 0)
      .setDepth(6);
    this.addLogLine("Combat begins!");
  }

  private addLogLine(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 6) this.logLines.shift();
    this.logText.setText(this.logLines.join("\n"));
  }

  private selectStack(index: number): void {
    if (this.combatOver || index === this.activeStackIndex) return;
    const stack = this.heroArmy[index];
    if (!stack || stack.currentHp <= 0) return;

    // Update outlines
    this.heroSprites[this.activeStackIndex]?.setStrokeStyle(2, 0x222222);
    this.activeStackIndex = index;
    this.heroSprites[this.activeStackIndex]?.setStrokeStyle(4, 0xffff44);
  }

  private formatStackLabel(name: string, count: number): string {
    return `${name}  x${count}`;
  }

  private spawnDamageText(x: number, y: number, amount: number): void {
    const text = this.add
      .text(x, y, `-${amount}`, { fontSize: "28px", color: "#cc4444" })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 600, onComplete: () => text.destroy() });
  }

  private spawnDeathPuff(target: "hero" | "enemy", count: number): void {
    const sprite = target === "hero" ? this.heroSprites[this.activeStackIndex]! : this.enemySprite;
    const color = target === "hero" ? (HERO_STACK_FILLS[this.activeStackIndex] ?? 0xffcc44) : this.enemyColor;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 100, () => this.spawnSinglePuff(sprite, color));
    }
  }

  private spawnSinglePuff(sprite: Phaser.GameObjects.Arc, color: number): void {
    const puff = this.add
      .circle(
        sprite.x + Phaser.Math.Between(-15, 15),
        sprite.y + Phaser.Math.Between(-15, 15),
        8,
        color,
        0.8
      )
      .setDepth(30);
    this.tweens.add({
      targets: puff,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 400,
      ease: "Cubic.easeOut",
      onComplete: () => puff.destroy(),
    });
  }

  private shakeOnHit(sprite: Phaser.GameObjects.Arc): void {
    if (this.combatOver) return;
    const origX = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: origX - 6,
      duration: 50,
      ease: "Linear",
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          x: origX + 6,
          duration: 50,
          ease: "Linear",
          onComplete: () => {
            this.tweens.add({
              targets: sprite,
              x: origX - 4,
              duration: 50,
              ease: "Linear",
              onComplete: () => {
                this.tweens.add({ targets: sprite, x: origX, duration: 50, ease: "Linear" });
              },
            });
          },
        });
      },
    });
  }

  private lungeAttack(
    attacker: "hero" | "enemy",
    onPeak: () => void,
    onLungeComplete?: () => void
  ): void {
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

    this.lungeAttack(
      "hero",
      () => {
        const oldEnemyHp = this.enemyHp;
        const dmg = this.rollHeroDamage();
        const newEnemyHp = Math.max(0, oldEnemyHp - dmg);
        this.enemyHp = newEnemyHp;
        this.enemyHpText.setText(`HP: ${this.enemyHp}`);
        this.enemyStackLabel.setText(
          this.formatStackLabel(this.enemyName, unitsRemaining(this.enemyHp, this.enemyHpPerUnit))
        );
        this.enemyBarFill.displayWidth = Math.max(0, (this.enemyHp / this.enemyMaxHp) * BAR_WIDTH);
        this.spawnDamageText(960, 400, dmg);
        this.shakeOnHit(this.enemySprite);
        const killed = unitsRemaining(oldEnemyHp, this.enemyHpPerUnit) - unitsRemaining(newEnemyHp, this.enemyHpPerUnit);
        if (killed > 0) this.spawnDeathPuff("enemy", killed);

        const activeName = this.heroArmy[this.activeStackIndex]?.name ?? "Hero";
        const killSuffix = killed > 0 ? ` (Killed ${killed})` : "";
        this.addLogLine(`${activeName} attack ${this.enemyName} for ${dmg} damage.${killSuffix}`);

        if (this.enemyHp <= 0) {
          this.addLogLine(`${activeName} killed ${this.enemyName}!`);
          this.combatOver = true;
          this.attackBtn.setAlpha(0.5).disableInteractive();
          this.showOutcome(true);
        }
      },
      () => {
        if (!this.combatOver) {
          this.time.delayedCall(400, () => this.enemyAttack());
        }
      }
    );
  }

  private enemyAttack(): void {
    this.lungeAttack("enemy", () => {
      const dmg = this.rollEnemyDamage();
      const activeStack = this.heroArmy[this.activeStackIndex];
      if (!activeStack) return;

      const oldHeroHp = activeStack.currentHp;
      activeStack.currentHp = Math.max(0, oldHeroHp - dmg);
      const stackMax = activeStack.count * activeStack.hpPerUnit;
      this.heroHpTexts[this.activeStackIndex]?.setText(
        `HP: ${activeStack.currentHp}/${stackMax}`
      );
      this.heroStackLabels[this.activeStackIndex]?.setText(
        this.formatStackLabel(activeStack.name, unitsRemaining(activeStack.currentHp, activeStack.hpPerUnit))
      );
      this.heroBarFills[this.activeStackIndex]!.displayWidth = Math.max(
        0,
        (activeStack.currentHp / stackMax) * HERO_BAR_WIDTH
      );
      this.spawnDamageText(HERO_STACK_X[this.activeStackIndex]!, 400, dmg);
      this.shakeOnHit(this.heroSprites[this.activeStackIndex]!);
      const heroKilled = unitsRemaining(oldHeroHp, activeStack.hpPerUnit) - unitsRemaining(activeStack.currentHp, activeStack.hpPerUnit);
      if (heroKilled > 0) this.spawnDeathPuff("hero", heroKilled);

      const heroKillSuffix = heroKilled > 0 ? ` (Killed ${heroKilled})` : "";
      this.addLogLine(`${this.enemyName} attacks ${activeStack.name} for ${dmg} damage.${heroKillSuffix}`);

      if (activeStack.currentHp <= 0) {
        this.addLogLine(`${activeStack.name} routed!`);
        // Auto-switch to next living stack
        const nextAlive = this.heroArmy.findIndex((s, idx) => idx !== this.activeStackIndex && s.currentHp > 0);
        if (nextAlive !== -1) {
          this.heroSprites[this.activeStackIndex]?.setStrokeStyle(2, 0x222222);
          this.activeStackIndex = nextAlive;
          this.heroSprites[this.activeStackIndex]?.setStrokeStyle(4, 0xffff44);
        } else {
          this.combatOver = true;
          this.attackBtn.setAlpha(0.5).disableInteractive();
          this.showOutcome(false);
        }
      }
    });
  }

  private showOutcome(victory: boolean): void {
    const text = victory ? "VICTORY!" : "DEFEAT";
    const color = victory ? "#44cc44" : "#cc4444";
    this.addLogLine(text);
    this.add.text(640, 560, text, { fontSize: "40px", color }).setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      if (victory) {
        this.scene.start("MapScene", {
          defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
          defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
          heroCol: this.initData.enemyCol,
          heroRow: this.initData.enemyRow,
          heroArmy: this.heroArmy,
          xpGained: this.initData.xpReward ?? 0,
        });
      } else {
        this.scene.start("MapScene", { heroHp: HERO_HP });
      }
    });
  }
}
