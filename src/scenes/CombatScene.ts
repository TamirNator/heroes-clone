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

const SAVE_KEY = "heroes-clone:save";

function saveCombatState(state: object): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const save = raw ? JSON.parse(raw) : {};
    save.inCombat = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

function clearCombatSave(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    delete save.inCombat;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
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
  private enemySprites: Phaser.GameObjects.Arc[] = [];
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyStackLabel!: Phaser.GameObjects.Text;
  private enemyBarFill!: Phaser.GameObjects.Rectangle;
  private attackBtn!: Phaser.GameObjects.Rectangle;
  public logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  public roundNumber = 1;
  private roundText!: Phaser.GameObjects.Text;
  public autoAttack = false;
  private autoBtn!: Phaser.GameObjects.Rectangle;
  private autoBtnText!: Phaser.GameObjects.Text;
  public combatSpeed = 1;
  private speedBtn!: Phaser.GameObjects.Rectangle;
  private speedBtnText!: Phaser.GameObjects.Text;

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
    roundNumber?: number;
  } = {};

  // Back-compat getter: total hero HP across all stacks
  get heroHp(): number {
    return this.heroArmy.reduce((s, u) => s + u.currentHp, 0);
  }

  // Back-compat getter: returns active hero stack's sprite
  get heroSprite(): Phaser.GameObjects.Arc {
    return this.heroSprites[this.activeStackIndex]!;
  }

  // Back-compat getter: front (leftmost) enemy sprite
  get enemySprite(): Phaser.GameObjects.Arc {
    return this.enemySprites[0]!;
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
    roundNumber?: number;
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
    // Restore round if resuming from saved combat
    this.roundNumber = this.initData.roundNumber ?? 1;
    this.autoAttack = false;
    this.combatSpeed = 1;
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
    this.enemySprites = [];
    const stackCount = this.initData.enemyStackCount ?? 1;
    const enemyR = stackCount === 1 ? 50 : stackCount === 2 ? 40 : 35;
    const spacing = enemyR * 1.6;
    const startX = 960 - ((stackCount - 1) / 2) * spacing;
    for (let i = 0; i < stackCount; i++) {
      const sprite = this.add
        .circle(startX + i * spacing, 360, enemyR, this.enemyColor)
        .setStrokeStyle(2, 0x222222);
      this.enemySprites.push(sprite);
    }
    this.enemyHpText = this.add
      .text(960, 455, `HP: ${this.enemyHp}`, { fontSize: "24px", color: "#cc4444" })
      .setOrigin(0.5);

    // VS + round counter
    this.add.text(640, 340, "VS", { fontSize: "32px", color: "#888888" }).setOrigin(0.5);
    this.roundText = this.add
      .text(640, 380, `Round ${this.roundNumber}`, { fontSize: "16px", color: "#888888" })
      .setOrigin(0.5);

    // Scene-in fade: black overlay fading out
    const fade = this.add
      .rectangle(640, 360, 1280, 720, 0x000000)
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({ targets: fade, alpha: 0, duration: 250, onComplete: () => fade.destroy() });

    // Return button — rects[0]
    const returnBtn = this.add
      .rectangle(120, 50, 160, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5)
      .setInteractive();

    this.add.text(120, 50, "Return to Map", { fontSize: "18px", color: "#ffcc44" }).setOrigin(0.5);

    returnBtn.on("pointerover", () => returnBtn.setFillStyle(0x4a6a8a));
    returnBtn.on("pointerout", () => returnBtn.setFillStyle(0x2a3a4a));
    returnBtn.on("pointerdown", () => {
      clearCombatSave();
      this.scene.start("MapScene", {
        defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
        defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
        heroCol: this.initData.enemyCol,
        heroRow: this.initData.enemyRow,
        heroArmy: this.heroArmy,
      });
    });

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

    // AUTO toggle button to right of Attack
    this.autoBtn = this.add
      .rectangle(470, 530, 100, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0x888888)
      .setOrigin(0.5)
      .setInteractive();
    this.autoBtnText = this.add
      .text(470, 530, "AUTO", { fontSize: "18px", color: "#888888" })
      .setOrigin(0.5);
    this.autoBtn.on("pointerover", () => {
      if (!this.autoAttack) this.autoBtn.setFillStyle(0x4a6a8a);
    });
    this.autoBtn.on("pointerout", () => {
      this.autoBtn.setFillStyle(this.autoAttack ? 0x44cc44 : 0x2a3a4a);
    });
    this.autoBtn.on("pointerdown", () => this.toggleAuto());

    // Speed cycle button (1× → 2× → 4×)
    this.speedBtn = this.add
      .rectangle(620, 530, 100, 40, 0x2a3a4a)
      .setStrokeStyle(2, 0x888888)
      .setOrigin(0.5)
      .setInteractive();
    this.speedBtnText = this.add
      .text(620, 530, "Speed: 1×", { fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5);
    this.speedBtn.on("pointerover", () => this.speedBtn.setFillStyle(0x4a6a8a));
    this.speedBtn.on("pointerout", () => this.speedBtn.setFillStyle(0x2a3a4a));
    this.speedBtn.on("pointerdown", () => this.cycleSpeed());

    // Keyboard shortcuts: A = Attack, O = toggle Auto, 1/2 = select stack, ESC = Return
    this.input.keyboard?.on("keydown-A", () => this.onAttack());
    this.input.keyboard?.on("keydown-O", () => this.toggleAuto());
    this.input.keyboard?.on("keydown-ONE", () => this.selectStack(0));
    this.input.keyboard?.on("keydown-TWO", () => this.selectStack(1));
    this.input.keyboard?.on("keydown-ESC", () => {
      clearCombatSave();
      this.scene.start("MapScene", {
        defeatedCol: this.initData.originalCol ?? this.initData.enemyCol,
        defeatedRow: this.initData.originalRow ?? this.initData.enemyRow,
        heroCol: this.initData.enemyCol,
        heroRow: this.initData.enemyRow,
        heroArmy: this.heroArmy,
      });
    });

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

  private cycleSpeed(): void {
    this.combatSpeed = this.combatSpeed === 1 ? 2 : this.combatSpeed === 2 ? 4 : 1;
    this.speedBtnText.setText(`Speed: ${this.combatSpeed}×`);
  }

  // Scale a duration by current speed (faster = shorter durations)
  private scaled(ms: number): number {
    return Math.max(1, Math.floor(ms / this.combatSpeed));
  }

  private toggleAuto(): void {
    if (this.combatOver) return;
    this.autoAttack = !this.autoAttack;
    this.autoBtn.setFillStyle(this.autoAttack ? 0x44cc44 : 0x2a3a4a);
    this.autoBtn.setStrokeStyle(2, this.autoAttack ? 0x44cc44 : 0x888888);
    this.autoBtnText.setColor(this.autoAttack ? "#ffffff" : "#888888");
    if (this.autoAttack && !this.isCombatAnimating) {
      this.time.delayedCall(200, () => {
        if (this.autoAttack && !this.combatOver && !this.isCombatAnimating) this.onAttack();
      });
    }
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
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: this.scaled(600), onComplete: () => text.destroy() });
  }

  private spawnDeathPuff(target: "hero" | "enemy", count: number): void {
    const sprite = target === "hero" ? this.heroSprites[this.activeStackIndex]! : this.enemySprite;
    const color = target === "hero" ? (HERO_STACK_FILLS[this.activeStackIndex] ?? 0xffcc44) : this.enemyColor;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(this.scaled(i * 100), () => this.spawnSinglePuff(sprite, color));
    }
    // Camera shake scaled by kill count: 1 unit = subtle, 4+ units = forceful
    const intensity = Math.min(0.012, 0.003 + count * 0.002);
    const duration = Math.min(300, 120 + count * 40);
    this.cameras.main.shake(this.scaled(duration), intensity);
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
      duration: this.scaled(400),
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
      duration: this.scaled(50),
      ease: "Linear",
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          x: origX + 6,
          duration: this.scaled(50),
          ease: "Linear",
          onComplete: () => {
            this.tweens.add({
              targets: sprite,
              x: origX - 4,
              duration: this.scaled(50),
              ease: "Linear",
              onComplete: () => {
                this.tweens.add({ targets: sprite, x: origX, duration: this.scaled(50), ease: "Linear" });
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
      duration: this.scaled(100),
      ease: "Cubic.easeOut",
      onComplete: () => {
        onPeak();
        this.tweens.add({
          targets: sprite,
          x: origX,
          duration: this.scaled(100),
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

        // Hide enemy circles for dead units (rightmost first)
        const aliveCount = unitsRemaining(this.enemyHp, this.enemyHpPerUnit);
        for (let i = aliveCount; i < this.enemySprites.length; i++) {
          this.enemySprites[i]?.setVisible(false);
        }

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
          this.time.delayedCall(this.scaled(400), () => this.enemyAttack());
        }
      }
    );
  }

  private enemyAttack(): void {
    this.lungeAttack(
      "enemy",
      () => this.doEnemyAttackPeak(),
      () => {
        if (!this.combatOver) {
          this.roundNumber += 1;
          this.roundText.setText(`Round ${this.roundNumber}`);
          this.persistCombatState();
          if (this.autoAttack) {
            this.time.delayedCall(200, () => {
              if (this.autoAttack && !this.combatOver && !this.isCombatAnimating) this.onAttack();
            });
          }
        }
      }
    );
  }

  private persistCombatState(): void {
    if (this.initData.enemyCol === undefined || this.initData.enemyRow === undefined) return;
    saveCombatState({
      enemyCol: this.initData.enemyCol,
      enemyRow: this.initData.enemyRow,
      originalCol: this.initData.originalCol ?? this.initData.enemyCol,
      originalRow: this.initData.originalRow ?? this.initData.enemyRow,
      enemyName: this.enemyName,
      enemyHp: this.enemyHp,
      enemyStackCount: this.initData.enemyStackCount ?? 1,
      enemyHpPerUnit: this.enemyHpPerUnit,
      enemyDamageMin: this.enemyDamageMin,
      enemyDamageMax: this.enemyDamageMax,
      xpReward: this.initData.xpReward ?? 0,
      heroArmy: this.heroArmy,
      roundNumber: this.roundNumber,
    });
  }

  // Pick which alive hero stack the enemy attacks.
  // Default (easy/normal): attack the player's active stack.
  // Hard difficulty: focus-fire the weakest alive stack (lowest currentHp).
  private chooseEnemyTarget(): number {
    const difficulty = (this.game.registry.get("difficulty") as string | undefined) ?? "normal";
    if (difficulty !== "hard") {
      // Default behavior: hit active stack if alive, otherwise next alive
      const active = this.heroArmy[this.activeStackIndex];
      if (active && active.currentHp > 0) return this.activeStackIndex;
      return this.heroArmy.findIndex(s => s.currentHp > 0);
    }
    // Hard: focus-fire weakest
    let bestIdx = -1;
    let bestHp = Infinity;
    for (let i = 0; i < this.heroArmy.length; i++) {
      const s = this.heroArmy[i]!;
      if (s.currentHp > 0 && s.currentHp < bestHp) {
        bestHp = s.currentHp;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private doEnemyAttackPeak(): void {
    const dmg = this.rollEnemyDamage();
    const targetIdx = this.chooseEnemyTarget();
    const targetStack = this.heroArmy[targetIdx];
    if (!targetStack) return;

    const oldHeroHp = targetStack.currentHp;
    targetStack.currentHp = Math.max(0, oldHeroHp - dmg);
    const stackMax = targetStack.count * targetStack.hpPerUnit;
    this.heroHpTexts[targetIdx]?.setText(`HP: ${targetStack.currentHp}/${stackMax}`);
    this.heroStackLabels[targetIdx]?.setText(
      this.formatStackLabel(targetStack.name, unitsRemaining(targetStack.currentHp, targetStack.hpPerUnit))
    );
    this.heroBarFills[targetIdx]!.displayWidth = Math.max(
      0,
      (targetStack.currentHp / stackMax) * HERO_BAR_WIDTH
    );
    this.spawnDamageText(HERO_STACK_X[targetIdx]!, 400, dmg);
    this.shakeOnHit(this.heroSprites[targetIdx]!);
    const heroKilled = unitsRemaining(oldHeroHp, targetStack.hpPerUnit) - unitsRemaining(targetStack.currentHp, targetStack.hpPerUnit);
    if (heroKilled > 0) this.spawnDeathPuffForStack(targetIdx, heroKilled);

    const heroKillSuffix = heroKilled > 0 ? ` (Killed ${heroKilled})` : "";
    this.addLogLine(`${this.enemyName} attacks ${targetStack.name} for ${dmg} damage.${heroKillSuffix}`);

    if (targetStack.currentHp <= 0) {
      this.addLogLine(`${targetStack.name} routed!`);
      // If the routed stack was the player's active, auto-switch to next living stack
      if (targetIdx === this.activeStackIndex) {
        const nextAlive = this.heroArmy.findIndex((s, idx) => idx !== this.activeStackIndex && s.currentHp > 0);
        if (nextAlive !== -1) {
          this.heroSprites[this.activeStackIndex]?.setStrokeStyle(2, 0x222222);
          this.activeStackIndex = nextAlive;
          this.heroSprites[this.activeStackIndex]?.setStrokeStyle(4, 0xffff44);
        }
      }
      // Check defeat: all stacks dead?
      if (this.heroArmy.every(s => s.currentHp <= 0)) {
        this.combatOver = true;
        this.attackBtn.setAlpha(0.5).disableInteractive();
        this.showOutcome(false);
      }
    }
  }

  // Variant of spawnDeathPuff that targets a specific hero stack index (not the active one).
  private spawnDeathPuffForStack(stackIndex: number, count: number): void {
    const sprite = this.heroSprites[stackIndex];
    if (!sprite) return;
    const color = HERO_STACK_FILLS[stackIndex] ?? 0xffcc44;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(this.scaled(i * 100), () => this.spawnSinglePuff(sprite, color));
    }
    const intensity = Math.min(0.012, 0.003 + count * 0.002);
    const duration = Math.min(300, 120 + count * 40);
    this.cameras.main.shake(this.scaled(duration), intensity);
  }

  private showOutcome(victory: boolean): void {
    clearCombatSave();
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
          lastOutcome: `VICTORY: defeated ${this.enemyName} (+${this.initData.xpReward ?? 0} XP)`,
        });
      } else {
        this.scene.start("MapScene", {
          heroHp: HERO_HP,
          lastOutcome: `DEFEAT by ${this.enemyName} — hero respawned`,
        });
      }
    });
  }
}
