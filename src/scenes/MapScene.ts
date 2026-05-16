import Phaser from "phaser";
import { sfxPickup, toggleAudio } from "../audio";

const COLS = 20;
const ROWS = 15;
const DEFAULT_FILL = 0x2a3a4a;
const STROKE_COLOR = 0x556677;
const HERO_FILL = 0xffcc44;
const HERO_STROKE = 0x222222;
const MOVEMENT_PER_TURN = 5;
const SAVE_KEY = "heroes-clone:save";
const HERO_HP = 10; // legacy constant kept for defeat-reset signal only
const HP_COLOR_HIGH = "#44cc44";
const HP_COLOR_MID = "#cccc44";
const HP_COLOR_LOW = "#cc4444";

type HeroStackState = {
  name: string;
  count: number;
  hpPerUnit: number;
  damageMin: number;
  damageMax: number;
  currentHp: number;
};

const DEFAULT_HERO_ARMY: HeroStackState[] = [
  { name: "Swordsmen", count: 5, hpPerUnit: 4, damageMin: 1, damageMax: 3, currentHp: 20 },
  { name: "Archers", count: 4, hpPerUnit: 2, damageMin: 2, damageMax: 4, currentHp: 8 },
];

function freshArmy(): HeroStackState[] {
  return DEFAULT_HERO_ARMY.map(u => ({ ...u }));
}

type LevelStats = { maxHp: number; dmgMin: number; dmgMax: number };
const LEVELS: LevelStats[] = [
  { maxHp: 10, dmgMin: 1, dmgMax: 3 },
  { maxHp: 13, dmgMin: 2, dmgMax: 4 },
  { maxHp: 17, dmgMin: 2, dmgMax: 5 },
  { maxHp: 22, dmgMin: 3, dmgMax: 6 },
];
const LEVEL_THRESHOLDS = [0, 5, 12, 25];

type Potion = { col: number; row: number };
const POTIONS: readonly Potion[] = [
  { col: 7, row: 9 },
  { col: 14, row: 4 },
  { col: 3, row: 10 },
];

type Scroll = { col: number; row: number };
type Town = { col: number; row: number };
const TOWNS: readonly Town[] = [
  { col: 10, row: 12 },
];
const SCROLLS: readonly Scroll[] = [
  { col: 12, row: 8 },
  { col: 5, row: 6 },
];

type Terrain = "grass" | "forest" | "water";
const TERRAIN_FILL: Record<Terrain, number> = {
  grass: 0x2a3a4a,
  forest: 0x2d4a2d,
  water: 0x1a3a5a,
};
const TERRAIN_HOVER: Record<Terrain, number> = {
  grass: 0x4a6a8a,
  forest: 0x4a6a4a,
  water: 0x3a5a7a,
};
const TERRAIN_OVERRIDES: Record<string, Terrain> = {
  "6,3": "water", "7,3": "water", "6,4": "water", "7,4": "water",
  "13,5": "water", "13,6": "water", "13,7": "water", "13,8": "water",
  "2,2": "forest", "3,2": "forest", "2,3": "forest",
  "8,9": "forest", "9,9": "forest", "8,10": "forest", "9,10": "forest",
  "16,3": "forest", "17,3": "forest", "16,4": "forest",
};
const TERRAIN_COST: Record<Terrain, number> = {
  grass: 1,
  forest: 2,
  water: Infinity,
};

type Enemy = { col: number; row: number; name: string; stackCount: number; hpPerUnit: number; damageMin: number; damageMax: number; movesPerTurn: number; range?: number; xpReward: number };
const ENEMIES: readonly Enemy[] = [
  { col: 4, row: 4, name: "Goblin", stackCount: 3, hpPerUnit: 1, damageMin: 1, damageMax: 1, movesPerTurn: 1, xpReward: 2 },
  { col: 10, row: 7, name: "Orc", stackCount: 5, hpPerUnit: 1, damageMin: 1, damageMax: 2, movesPerTurn: 1, xpReward: 4 },
  { col: 15, row: 11, name: "Troll", stackCount: 4, hpPerUnit: 2, damageMin: 2, damageMax: 3, movesPerTurn: 1, xpReward: 7 },
  { col: 5, row: 11, name: "Wolf", stackCount: 2, hpPerUnit: 2, damageMin: 1, damageMax: 2, movesPerTurn: 2, xpReward: 3 },
  { col: 12, row: 2, name: "Wolf", stackCount: 2, hpPerUnit: 2, damageMin: 1, damageMax: 2, movesPerTurn: 2, xpReward: 3 },
  { col: 8, row: 12, name: "Archer", stackCount: 3, hpPerUnit: 1, damageMin: 1, damageMax: 2, movesPerTurn: 1, range: 3, xpReward: 4 },
];

type Hex = { col: number; row: number };

type LiveEnemy = {
  col: number;
  row: number;
  data: Enemy;
  sprite: Phaser.GameObjects.Arc;
  badge: Phaser.GameObjects.Text;
};

type SaveData = {
  defeated: string[];
  heroCol: number;
  heroRow: number;
  remainingMoves: number;
  heroHp: number;
  heroArmy?: HeroStackState[];
  heroXp?: number;
  heroLevel?: number;
  consumed?: string[];
  consumedScrolls?: string[];
  turnCount?: number;
  inCombat?: {
    enemyCol: number;
    enemyRow: number;
    originalCol: number;
    originalRow: number;
    enemyName: string;
    enemyHp: number;
    enemyStackCount: number;
    enemyHpPerUnit: number;
    enemyDamageMin: number;
    enemyDamageMax: number;
    xpReward: number;
    heroArmy: HeroStackState[];
    roundNumber: number;
  };
};

export class MapScene extends Phaser.Scene {
  private heroCol = 0;
  private heroRow = 0;
  private heroSprite!: Phaser.GameObjects.Arc;
  private hexR = 0;
  private colStep = 0;
  private rowStep = 0;
  private startX = 0;
  private startY = 0;
  private remainingMoves = MOVEMENT_PER_TURN;
  isAnimating = false;
  private movesText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Rectangle;
  private resetBtn!: Phaser.GameObjects.Rectangle;
  liveEnemies: LiveEnemy[] = [];
  public lastPath: Hex[] = [];
  private heroHpLabel!: Phaser.GameObjects.Text;
  private heroDmgLabel!: Phaser.GameObjects.Text;
  private activeTooltip?: Phaser.GameObjects.Container;
  private potionSprites: Map<string, Phaser.GameObjects.Text> = new Map();
  private scrollSprites: Map<string, Phaser.GameObjects.Text> = new Map();
  private heroXpLabel!: Phaser.GameObjects.Text;
  private gameWon = false;
  public helpOverlay?: Phaser.GameObjects.Container;
  private turnLabel?: Phaser.GameObjects.Text;
  private initData: {
    defeatedCol?: number;
    defeatedRow?: number;
    heroCol?: number;
    heroRow?: number;
    heroHp?: number;
    heroArmy?: HeroStackState[];
    xpGained?: number;
    lastOutcome?: string;
  } = {};

  constructor() {
    super("MapScene");
  }

  init(data: { defeatedCol?: number; defeatedRow?: number; heroCol?: number; heroRow?: number; heroHp?: number; heroArmy?: HeroStackState[]; xpGained?: number; lastOutcome?: string }): void {
    this.initData = data ?? {};
  }

  create(): void {
    this.isAnimating = false;
    this.liveEnemies = [];
    this.gameWon = false;

    // Ensure registry exists.
    if (!this.registry.has("defeatedEnemies")) {
      this.registry.set("defeatedEnemies", new Set<string>());
    }
    if (!this.registry.has("heroArmy")) {
      this.registry.set("heroArmy", freshArmy());
    }
    if (!this.registry.has("heroHp")) {
      this.registry.set("heroHp", this.getHeroHp());
    }
    if (!this.registry.has("heroXp")) {
      this.registry.set("heroXp", 0);
    }
    if (!this.registry.has("heroLevel")) {
      this.registry.set("heroLevel", 1);
    }
    if (!this.registry.has("consumedPotions")) {
      this.registry.set("consumedPotions", new Set<string>());
    }
    if (!this.registry.has("consumedScrolls")) {
      this.registry.set("consumedScrolls", new Set<string>());
    }

    // Detect whether we arrived here from a scene transition (post-combat data) or a fresh/reset start.
    const isSceneTransition = this.initData.heroCol !== undefined || this.initData.defeatedCol !== undefined;

    if (isSceneTransition) {
      this.heroCol = this.initData.heroCol ?? 0;
      this.heroRow = this.initData.heroRow ?? 0;
      this.remainingMoves = MOVEMENT_PER_TURN;
      if (this.initData.defeatedCol !== undefined && this.initData.defeatedRow !== undefined) {
        (this.registry.get("defeatedEnemies") as Set<string>).add(
          `${this.initData.defeatedCol},${this.initData.defeatedRow}`
        );
        // Persistent total-kills counter (across all runs)
        const prevKills = (this.registry.get("totalKills") as number | undefined) ?? 0;
        this.registry.set("totalKills", prevKills + 1);
        try {
          localStorage.setItem("heroes-clone:totalKills", String(prevKills + 1));
        } catch {
          /* ignore */
        }
      }
      if (this.initData.heroArmy !== undefined) {
        this.registry.set("heroArmy", this.initData.heroArmy);
        this.registry.set("heroHp", this.getHeroHp());
      } else if (this.initData.heroHp !== undefined) {
        this.registry.set("heroHp", Math.max(1, this.initData.heroHp));
      }
      if (this.initData.xpGained !== undefined) {
        this.applyXpGain(this.initData.xpGained);
        // Loot drop: 30% chance after any victory to grant +5 HP or +3 XP (registry override for tests)
        const lootChance = (this.registry.get("lootChance") as number | undefined) ?? 0.3;
        if (Math.random() < lootChance) {
          const heal = Math.random() < 0.5;
          if (heal) {
            const army = this.getHeroArmy();
            let remaining = 5;
            for (const stack of army) {
              const stackMax = stack.count * stack.hpPerUnit;
              if (stack.currentHp < stackMax && remaining > 0) {
                const added = Math.min(remaining, stackMax - stack.currentHp);
                stack.currentHp += added;
                remaining -= added;
              }
            }
            this.registry.set("heroArmy", army);
            this.registry.set("heroHp", this.getHeroHp());
            this.initData.lastOutcome = (this.initData.lastOutcome ?? "") + " — Loot: +5 HP";
          } else {
            this.applyXpGain(3);
            this.initData.lastOutcome = (this.initData.lastOutcome ?? "") + " — Loot: +3 XP";
          }
        }
      }
      this.saveProgress();
    } else {
      // Fresh page load or post-Reset/NewGame (save is already cleared).
      // Also handles defeat (heroHp: HERO_HP passed, no position data).
      const save = this.loadProgress();
      if (save) {
        this.heroCol = save.heroCol;
        this.heroRow = save.heroRow;
        this.remainingMoves = save.remainingMoves;
        const defeatedSet = this.registry.get("defeatedEnemies") as Set<string>;
        defeatedSet.clear();
        for (const key of save.defeated) {
          defeatedSet.add(key);
        }
        if (save.heroArmy !== undefined) {
          this.registry.set("heroArmy", save.heroArmy);
          this.registry.set("heroHp", this.getHeroHp());
        } else if (save.heroHp !== undefined) {
          this.registry.set("heroHp", save.heroHp);
        }
        if (save.heroXp !== undefined) {
          this.registry.set("heroXp", save.heroXp);
        }
        if (save.heroLevel !== undefined) {
          this.registry.set("heroLevel", save.heroLevel);
        }
        if (save.consumed !== undefined) {
          const consumedSet = this.consumedPotions();
          consumedSet.clear();
          for (const key of save.consumed) {
            consumedSet.add(key);
          }
        }
        if (save.consumedScrolls !== undefined) {
          const scrollConsumedSet = this.consumedScrolls();
          scrollConsumedSet.clear();
          for (const key of save.consumedScrolls) {
            scrollConsumedSet.add(key);
          }
        }
        if (save.turnCount !== undefined) {
          this.registry.set("turnCount", save.turnCount);
        }
      } else {
        this.heroCol = 0;
        this.heroRow = 0;
        this.remainingMoves = MOVEMENT_PER_TURN;
      }
      // Defeat passes heroHp: HERO_HP without army — reset army and persist.
      if (this.initData.heroHp !== undefined) {
        this.registry.set("heroArmy", freshArmy());
        this.registry.set("heroHp", this.getHeroHp());
        this.saveProgress();
      }
    }

    const margin = 20;
    const rFromW = (1280 - 2 * margin) / ((COLS + 0.5) * Math.sqrt(3));
    const rFromH = (720 - 2 * margin) / (1.5 * ROWS + 0.5);
    this.hexR = Math.min(rFromW, rFromH);

    this.colStep = Math.sqrt(3) * this.hexR;
    this.rowStep = 1.5 * this.hexR;

    const gridW = (COLS + 0.5) * this.colStep;
    const gridH = (1.5 * ROWS + 0.5) * this.hexR;
    this.startX = (1280 - gridW) / 2 + this.colStep / 2;
    this.startY = (720 - gridH) / 2 + this.hexR;

    const points = this.hexPointsRelative(this.hexR);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const { x: cx, y: cy } = this.hexCenter(col, row);

        const terrain = this.terrainAt(col, row);
        const fill = TERRAIN_FILL[terrain];
        const hoverFill = TERRAIN_HOVER[terrain];

        const poly = this.add.polygon(cx, cy, points, fill);
        poly.setOrigin(0);
        poly.setStrokeStyle(1.5, STROKE_COLOR);
        poly.setInteractive(
          new Phaser.Geom.Polygon(points),
          Phaser.Geom.Polygon.Contains
        );

        poly.on("pointerover", () => {
          poly.setFillStyle(hoverFill);
          const le = this.liveEnemies.find(e => e.col === col && e.row === row);
          if (le) this.showEnemyTooltip(le.data, le.sprite);
        });
        poly.on("pointerout", () => {
          poly.setFillStyle(fill);
          this.hideEnemyTooltip();
        });
        poly.on("pointerdown", () => this.onHexClicked(col, row));
      }
    }

    const { x, y } = this.hexCenter(this.heroCol, this.heroRow);
    this.heroSprite = this.add
      .circle(x, y, this.hexR * 0.45, HERO_FILL)
      .setStrokeStyle(2, HERO_STROKE)
      .setDepth(10);

    const randomSpawns = this.registry.get("randomEnemySpawns") as Array<{ col: number; row: number }> | undefined;
    const difficulty = (this.registry.get("difficulty") as "easy" | "normal" | "hard" | undefined) ?? "normal";
    const hpScale = difficulty === "easy" ? 0.6 : difficulty === "hard" ? 1.6 : 1.0;
    for (let i = 0; i < ENEMIES.length; i++) {
      const enemyDef = ENEMIES[i]!;
      const spawn = randomSpawns?.[i] ?? { col: enemyDef.col, row: enemyDef.row };
      // Apply difficulty: scale stackCount (HP per unit unchanged so visual stack count varies)
      const scaledStack = Math.max(1, Math.round(enemyDef.stackCount * hpScale));
      // Defeat tracking key uses the effective spawn (random or default)
      const enemy: Enemy = { ...enemyDef, col: spawn.col, row: spawn.row, stackCount: scaledStack };
      if (this.isDefeated(enemy.col, enemy.row)) continue;
      const { x: ex, y: ey } = this.hexCenter(enemy.col, enemy.row);
      const fillColor = enemy.name === "Wolf" ? 0xff8844 : enemy.name === "Archer" ? 0xcccc44 : 0xcc4444;
      const sprite = this.add
        .circle(ex, ey, this.hexR * 0.45, fillColor)
        .setStrokeStyle(2, 0x222222)
        .setDepth(10);
      const badge = this.add
        .text(ex + this.hexR * 0.55, ey + this.hexR * 0.5, `x${enemy.stackCount}`, {
          fontSize: "12px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5)
        .setDepth(11);
      this.liveEnemies.push({ col: enemy.col, row: enemy.row, data: enemy, sprite, badge });
    }

    // Render potions (random or default)
    this.potionSprites = new Map();
    const consumedSet = this.consumedPotions();
    const randomPotions = this.registry.get("randomPotions") as Array<{ col: number; row: number }> | undefined;
    const potionList = randomPotions ?? POTIONS;
    for (const potion of potionList) {
      if (consumedSet.has(`${potion.col},${potion.row}`)) continue;
      const { x: cx, y: cy } = this.hexCenter(potion.col, potion.row);
      const sprite = this.add.text(cx, cy, "+", {
        fontSize: "32px",
        color: "#44cc44",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(5);
      this.potionSprites.set(`${potion.col},${potion.row}`, sprite);
    }

    // Render scrolls (random or default)
    this.scrollSprites = new Map();
    const consumedScrollSet = this.consumedScrolls();
    const randomScrolls = this.registry.get("randomScrolls") as Array<{ col: number; row: number }> | undefined;
    const scrollList = randomScrolls ?? SCROLLS;
    for (const scroll of scrollList) {
      if (consumedScrollSet.has(`${scroll.col},${scroll.row}`)) continue;
      const { x: cx, y: cy } = this.hexCenter(scroll.col, scroll.row);
      const sprite = this.add.text(cx, cy, "B", {
        fontSize: "28px",
        color: "#4488cc",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(5);
      this.scrollSprites.set(`${scroll.col},${scroll.row}`, sprite);
    }

    // Render towns — never consumed; walking onto fully heals all hero stacks
    const randomTowns = this.registry.get("randomTowns") as Array<{ col: number; row: number }> | undefined;
    const townList = randomTowns ?? TOWNS;
    for (const town of townList) {
      const { x: cx, y: cy } = this.hexCenter(town.col, town.row);
      this.add
        .text(cx, cy, "T", { fontSize: "32px", color: "#88ccff", fontStyle: "bold" })
        .setOrigin(0.5)
        .setDepth(5);
    }

    const defeated = this.registry.get("defeatedEnemies") as Set<string>;
    if (defeated.size >= ENEMIES.length) {
      this.renderWinOverlay();
      // Record hall-of-fame best level reached on full clears
      try {
        const level = this.getHeroLevel();
        const prevBest = parseInt(localStorage.getItem("heroes-clone:bestLevel") ?? "0", 10) || 0;
        if (level > prevBest) localStorage.setItem("heroes-clone:bestLevel", String(level));
      } catch {
        /* ignore */
      }
    }

    // Help overlay — toggle with H or ?
    this.input.keyboard?.on("keydown-H", () => this.toggleHelp());
    this.input.keyboard?.on("keydown-FORWARD_SLASH", () => this.toggleHelp());
    // Mute toggle — M
    this.input.keyboard?.on("keydown-M", () => {
      const on = toggleAudio();
      this.showMuteToast(on);
    });

    this.movesText = this.add
      .text(1280 - 20, 20, `Moves: ${this.remainingMoves}`, {
        fontSize: "20px",
        color: "#ffcc44",
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.endTurnBtn = this.add
      .rectangle(1280 - 20, 50, 120, 36, DEFAULT_FILL)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();

    this.add
      .text(1280 - 20 - 60, 50 + 18, "End Turn", {
        fontSize: "18px",
        color: "#ffcc44",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(21);

    this.endTurnBtn.on("pointerover", () => {
      if (!this.isAnimating) this.endTurnBtn.setFillStyle(TERRAIN_HOVER.grass);
    });
    this.endTurnBtn.on("pointerout", () => {
      this.endTurnBtn.setFillStyle(DEFAULT_FILL);
    });
    this.endTurnBtn.on("pointerdown", () => {
      if (!this.isAnimating && !this.gameWon) this.endTurn();
    });

    // Reset button — red-stroked, destructive action
    this.resetBtn = this.add
      .rectangle(1280 - 20, 110, 100, 30, DEFAULT_FILL)
      .setStrokeStyle(2, 0xcc4444)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();

    this.add
      .text(1280 - 20 - 50, 110 + 15, "Reset", {
        fontSize: "14px",
        color: "#cc4444",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(21);

    this.resetBtn.on("pointerover", () => {
      if (!this.isAnimating && !this.gameWon) this.resetBtn.setFillStyle(TERRAIN_HOVER.grass);
    });
    this.resetBtn.on("pointerout", () => {
      this.resetBtn.setFillStyle(DEFAULT_FILL);
    });
    this.resetBtn.on("pointerdown", () => {
      if (!this.isAnimating && !this.gameWon) this.confirmReset();
    });

    // Title button — return to title screen (no save loss)
    const titleBtn = this.add
      .rectangle(1280 - 20, 145, 100, 26, DEFAULT_FILL)
      .setStrokeStyle(1, 0x888888)
      .setOrigin(1, 0)
      .setDepth(20)
      .setInteractive();
    this.add
      .text(1280 - 20 - 50, 145 + 13, "Title", { fontSize: "12px", color: "#cccccc" })
      .setOrigin(0.5, 0.5)
      .setDepth(21);
    titleBtn.on("pointerover", () => titleBtn.setFillStyle(0x4a6a8a));
    titleBtn.on("pointerout", () => titleBtn.setFillStyle(DEFAULT_FILL));
    titleBtn.on("pointerdown", () => {
      if (!this.isAnimating) this.scene.start("TitleScene");
    });

    // Hero HP label
    const hp = this.getHeroHp();
    const maxHp = this.getHeroMaxHp();
    this.heroHpLabel = this.add
      .text(1280 - 20, 175, `HP: ${hp}/${maxHp}`, { fontSize: "18px", color: this.hpColor(hp) })
      .setOrigin(1, 0)
      .setDepth(20);

    // Level + XP label
    const level = this.getHeroLevel();
    const xp = this.getHeroXp();
    const nextThreshold = LEVEL_THRESHOLDS[level];
    const xpText = nextThreshold !== undefined ? `Lvl ${level} • XP: ${xp}/${nextThreshold}` : `Lvl ${level} • MAX`;
    this.heroXpLabel = this.add
      .text(1280 - 20, 200, xpText, { fontSize: "14px", color: "#ffcc44" })
      .setOrigin(1, 0)
      .setDepth(20);

    // Hero damage range label (derived from first army stack)
    const firstStack = this.getHeroArmy()[0]!;
    this.heroDmgLabel = this.add
      .text(1280 - 20, 225, `DMG: ${firstStack.damageMin}-${firstStack.damageMax}`, { fontSize: "16px", color: "#ffcc44" })
      .setOrigin(1, 0)
      .setDepth(20);

    // Enemies remaining counter
    const remaining = ENEMIES.length - (this.registry.get("defeatedEnemies") as Set<string>).size;
    this.add
      .text(1280 - 20, 250, `Enemies: ${remaining}/${ENEMIES.length}`, { fontSize: "14px", color: "#cc8888" })
      .setOrigin(1, 0)
      .setDepth(20);

    // Turn counter (left of Moves)
    if (!this.registry.has("turnCount")) this.registry.set("turnCount", 1);
    const turn = this.registry.get("turnCount") as number;
    this.turnLabel = this.add
      .text(20, 20, `Turn ${turn}`, { fontSize: "16px", color: "#cccccc" })
      .setOrigin(0, 0)
      .setDepth(20);

    // Seed label + Share button (only on seeded runs)
    const seedLabel = this.registry.get("seedLabel") as string | undefined;
    if (seedLabel) {
      this.add
        .text(1280 - 20, 275, seedLabel, { fontSize: "11px", color: "#888888", fontStyle: "italic" })
        .setOrigin(1, 0)
        .setDepth(20);

      const shareBtn = this.add
        .rectangle(1280 - 20, 300, 100, 22, DEFAULT_FILL)
        .setStrokeStyle(1, 0x88ccff)
        .setOrigin(1, 0)
        .setDepth(20)
        .setInteractive();
      this.add
        .text(1280 - 20 - 50, 300 + 11, "Share", { fontSize: "11px", color: "#88ccff" })
        .setOrigin(0.5, 0.5)
        .setDepth(21);
      shareBtn.on("pointerover", () => shareBtn.setFillStyle(0x4a6a8a));
      shareBtn.on("pointerout", () => shareBtn.setFillStyle(DEFAULT_FILL));
      shareBtn.on("pointerdown", () => this.shareSeedUrl(seedLabel));
    }

    // Last combat outcome banner (briefly, if scene was entered with one)
    if (this.initData.lastOutcome) {
      const isVictory = this.initData.lastOutcome.startsWith("VICTORY");
      const banner = this.add
        .text(640, 30, this.initData.lastOutcome, {
          fontSize: "20px",
          color: isVictory ? "#44cc44" : "#cc4444",
          fontStyle: "bold",
          backgroundColor: "#000000",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5, 0)
        .setDepth(50);
      this.tweens.add({
        targets: banner,
        alpha: 0,
        delay: 2000,
        duration: 600,
        onComplete: () => banner.destroy(),
      });
    }
  }

  private shareSeedUrl(seedLabel: string): void {
    // seedLabel is "seed:N" or "daily:YYYY-MM-DD"
    let seed: number | null = null;
    if (seedLabel.startsWith("seed:")) {
      const n = parseInt(seedLabel.slice("seed:".length), 10);
      if (!isNaN(n)) seed = n;
    } else if (seedLabel.startsWith("daily:")) {
      // Reverse-derive: daily uses seedFromString("heroes-clone:" + date)
      const date = seedLabel.slice("daily:".length);
      let h = 0x811c9dc5;
      const s = `heroes-clone:${date}`;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      seed = h >>> 0;
    }
    if (seed === null) return;
    const url = `${window.location.origin}/?seed=${seed}`;
    let toastText = "URL copied to clipboard!";
    try {
      void navigator.clipboard.writeText(url);
    } catch {
      toastText = `Share URL: ${url}`;
    }
    const t = this.add
      .text(640, 80, toastText, {
        fontSize: "14px",
        color: "#88ccff",
        backgroundColor: "#000000",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, delay: 2000, duration: 500, onComplete: () => t.destroy() });
  }

  private showMuteToast(enabled: boolean): void {
    const text = enabled ? "Sound ON" : "Sound OFF";
    const t = this.add
      .text(640, 80, text, {
        fontSize: "18px",
        color: enabled ? "#44cc44" : "#cccccc",
        backgroundColor: "#000000",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 400, onComplete: () => t.destroy() });
  }

  private confirmReset(): void {
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7).setOrigin(0.5).setDepth(180);
    const panel = this.add.rectangle(640, 360, 460, 200, 0x1a1a1a).setStrokeStyle(2, 0xcc4444).setOrigin(0.5).setDepth(181);
    const title = this.add
      .text(640, 300, "Reset progress?", { fontSize: "24px", color: "#cc4444", fontStyle: "bold" })
      .setOrigin(0.5).setDepth(182);
    const body = this.add
      .text(640, 345, "This will wipe your save and start over.", { fontSize: "14px", color: "#cccccc" })
      .setOrigin(0.5).setDepth(182);
    const yesBtn = this.add
      .rectangle(540, 410, 140, 40, 0x2a3a4a).setStrokeStyle(2, 0xcc4444).setOrigin(0.5).setDepth(182).setInteractive();
    this.add.text(540, 410, "Yes, reset", { fontSize: "16px", color: "#cc4444" }).setOrigin(0.5).setDepth(183);
    const noBtn = this.add
      .rectangle(740, 410, 140, 40, 0x2a3a4a).setStrokeStyle(2, 0x888888).setOrigin(0.5).setDepth(182).setInteractive();
    this.add.text(740, 410, "Cancel", { fontSize: "16px", color: "#cccccc" }).setOrigin(0.5).setDepth(183);

    const dismiss = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      body.destroy();
      yesBtn.destroy();
      noBtn.destroy();
      // dismiss labels too — but their lifetimes are tied to scene; destroy via re-fetch isn't needed
    };

    yesBtn.on("pointerover", () => yesBtn.setFillStyle(0x4a2a2a));
    yesBtn.on("pointerout", () => yesBtn.setFillStyle(0x2a3a4a));
    yesBtn.on("pointerdown", () => {
      this.clearProgress();
      this.registry.set("heroArmy", freshArmy());
      this.registry.set("heroHp", this.getHeroHp());
      this.registry.set("heroXp", 0);
      this.registry.set("heroLevel", 1);
      this.registry.set("turnCount", 1);
      (this.registry.get("defeatedEnemies") as Set<string>).clear();
      this.consumedPotions().clear();
      this.consumedScrolls().clear();
      this.scene.start("MapScene", {});
    });
    noBtn.on("pointerover", () => noBtn.setFillStyle(0x4a6a8a));
    noBtn.on("pointerout", () => noBtn.setFillStyle(0x2a3a4a));
    noBtn.on("pointerdown", dismiss);
  }

  private toggleHelp(): void {
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
      this.helpOverlay = undefined;
      return;
    }
    const container = this.add.container(640, 360).setDepth(150);
    const bg = this.add
      .rectangle(0, 0, 640, 420, 0x000000, 0.9)
      .setStrokeStyle(2, 0xffcc44)
      .setOrigin(0.5);
    const title = this.add
      .text(0, -180, "HELP", { fontSize: "32px", color: "#ffcc44", fontStyle: "bold" })
      .setOrigin(0.5);
    const body = this.add
      .text(
        0,
        -10,
        [
          "MAP",
          "  • Click any hex — walk hero there (5 moves/turn)",
          "  • Click an enemy — walk into combat with it",
          "  • Hover an enemy — see its name, HP, damage",
          "  • End Turn button — refresh moves; enemies move",
          "  • Reset — wipe save; New Game from scratch",
          "",
          "COMBAT",
          "  • A — Attack with active stack",
          "  • 1 / 2 — switch active stack",
          "  • O — toggle Auto-attack",
          "  • ESC — Return to map",
          "",
          "GLOBAL",
          "  • M — toggle sound on/off",
          "  • H or ? — toggle this help",
        ].join("\n"),
        { fontSize: "14px", color: "#cccccc", lineSpacing: 4, align: "left" }
      )
      .setOrigin(0.5);
    const dismiss = this.add
      .text(0, 175, "[ press H or click anywhere to close ]", { fontSize: "12px", color: "#888888" })
      .setOrigin(0.5);
    container.add([bg, title, body, dismiss]);
    bg.setInteractive();
    bg.on("pointerdown", () => this.toggleHelp());
    this.helpOverlay = container;
  }

  private renderWinOverlay(): void {
    this.gameWon = true;

    this.add.rectangle(640, 360, 1280, 720, 0x000000).setAlpha(0.7).setDepth(100);
    this.add.text(640, 300, "GAME WON!", { fontSize: "64px", color: "#44cc44" }).setOrigin(0.5).setDepth(101);
    this.add.text(640, 370, "All enemies defeated", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5).setDepth(101);

    const newGameBtn = this.add
      .rectangle(640, 460, 200, 50, 0x2a3a4a)
      .setStrokeStyle(2, 0x44cc44)
      .setDepth(101)
      .setInteractive();
    this.add.text(640, 460, "New Game", { fontSize: "22px", color: "#44cc44" }).setOrigin(0.5).setDepth(102);

    newGameBtn.on("pointerover", () => newGameBtn.setFillStyle(0x4a6a8a));
    newGameBtn.on("pointerout", () => newGameBtn.setFillStyle(0x2a3a4a));
    newGameBtn.on("pointerdown", () => {
      this.clearProgress();
      this.registry.set("heroArmy", freshArmy());
      this.registry.set("heroHp", this.getHeroHp());
      this.registry.set("heroXp", 0);
      this.registry.set("heroLevel", 1);
      (this.registry.get("defeatedEnemies") as Set<string>).clear();
      this.consumedPotions().clear();
      this.consumedScrolls().clear();
      this.scene.start("MapScene", {});
    });
  }

  private isDefeated(col: number, row: number): boolean {
    return (this.registry.get("defeatedEnemies") as Set<string>).has(`${col},${row}`);
  }

  private saveProgress(): void {
    const defeatedSet = this.registry.get("defeatedEnemies") as Set<string>;
    const save: SaveData = {
      defeated: Array.from(defeatedSet),
      heroCol: this.heroCol,
      heroRow: this.heroRow,
      remainingMoves: this.remainingMoves,
      heroHp: this.getHeroHp(),
      heroArmy: this.getHeroArmy().map(u => ({ ...u })),
      heroXp: this.getHeroXp(),
      heroLevel: this.getHeroLevel(),
      consumed: Array.from(this.consumedPotions()),
      consumedScrolls: Array.from(this.consumedScrolls()),
      turnCount: (this.registry.get("turnCount") as number | undefined) ?? 1,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_e) {
      // localStorage unavailable (private mode, etc.) — fail silent
    }
  }

  private loadProgress(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SaveData;
    } catch (_e) {
      return null;
    }
  }

  private clearProgress(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_e) {
      // ignore
    }
  }

  private endTurn(): void {
    this.remainingMoves = MOVEMENT_PER_TURN;
    this.movesText.setText(`Moves: ${this.remainingMoves}`);
    const turn = ((this.registry.get("turnCount") as number | undefined) ?? 1) + 1;
    this.registry.set("turnCount", turn);
    this.turnLabel?.setText(`Turn ${turn}`);
    this.runEnemyTurn();
  }

  private runEnemyTurn(): void {
    this.isAnimating = true;
    this.endTurnBtn.setAlpha(0.5);
    this.runEnemyStep(0);
  }

  private runEnemyStep(index: number): void {
    if (index >= this.liveEnemies.length) {
      this.isAnimating = false;
      this.endTurnBtn.setAlpha(1);
      this.saveProgress();
      return;
    }
    const enemy = this.liveEnemies[index]!;
    if (enemy.data.range !== undefined) {
      const d = this.bfsDistance(enemy.col, enemy.row, this.heroCol, this.heroRow);
      if (d <= enemy.data.range) {
        this.shootHero(enemy);
        this.runEnemyStep(index + 1);
        return;
      }
    }
    this.runEnemyMultiStep(index, enemy.data.movesPerTurn);
  }

  private runEnemyMultiStep(index: number, stepsRemaining: number): void {
    if (stepsRemaining === 0) {
      this.runEnemyStep(index + 1);
      return;
    }

    const enemy = this.liveEnemies[index]!;
    const path = this.dijkstraPath(enemy.col, enemy.row, this.heroCol, this.heroRow);

    if (path.length === 0) {
      this.runEnemyStep(index + 1);
      return;
    }

    const nextStep = path[0]!;
    const { x, y } = this.hexCenter(nextStep.col, nextStep.row);

    const badgeTargetX = x + this.hexR * 0.55;
    const badgeTargetY = y + this.hexR * 0.5;
    this.tweens.add({
      targets: enemy.badge,
      x: badgeTargetX,
      y: badgeTargetY,
      duration: 150,
      ease: "Linear",
    });
    this.tweens.add({
      targets: enemy.sprite,
      x,
      y,
      duration: 150,
      ease: "Linear",
      onComplete: () => {
        enemy.col = nextStep.col;
        enemy.row = nextStep.row;

        if (enemy.col === this.heroCol && enemy.row === this.heroRow) {
          this.isAnimating = false;
          this.scene.start("CombatScene", {
            enemyCol: enemy.col,
            enemyRow: enemy.row,
            originalCol: enemy.data.col,
            originalRow: enemy.data.row,
            enemyName: enemy.data.name,
            enemyHp: enemy.data.stackCount * enemy.data.hpPerUnit,
            enemyStackCount: enemy.data.stackCount,
            enemyHpPerUnit: enemy.data.hpPerUnit,
            enemyDamageMin: enemy.data.damageMin,
            enemyDamageMax: enemy.data.damageMax,
            heroArmy: this.getHeroArmy().map(u => ({ ...u })),
            xpReward: enemy.data.xpReward,
          });
          return;
        }

        this.runEnemyMultiStep(index, stepsRemaining - 1);
      },
    });
  }

  private onHexClicked(col: number, row: number): void {
    if (this.isAnimating || this.remainingMoves === 0 || this.gameWon) return;
    if (col === this.heroCol && row === this.heroRow) return;

    const path = this.dijkstraPath(this.heroCol, this.heroRow, col, row);
    if (path.length === 0) return;

    this.lastPath = path;
    const steps = this.truncatePathToBudget(path, this.remainingMoves);
    this.isAnimating = true;
    this.endTurnBtn.setAlpha(0.5);
    this.animatePath(steps, 0);
  }

  private animatePath(steps: Hex[], index: number): void {
    if (index >= steps.length) {
      this.isAnimating = false;
      this.endTurnBtn.setAlpha(1);
      const le = this.liveEnemies.find(e => e.col === this.heroCol && e.row === this.heroRow);
      if (le) {
        this.scene.start("CombatScene", {
          enemyCol: le.col,
          enemyRow: le.row,
          originalCol: le.data.col,
          originalRow: le.data.row,
          enemyName: le.data.name,
          enemyHp: le.data.stackCount * le.data.hpPerUnit,
          enemyStackCount: le.data.stackCount,
          enemyHpPerUnit: le.data.hpPerUnit,
          enemyDamageMin: le.data.damageMin,
          enemyDamageMax: le.data.damageMax,
          heroArmy: this.getHeroArmy().map(u => ({ ...u })),
          xpReward: le.data.xpReward,
        });
      } else {
        this.saveProgress();
      }
      return;
    }
    const { col, row } = steps[index]!;
    const { x, y } = this.hexCenter(col, row);
    this.tweens.add({
      targets: this.heroSprite,
      x,
      y,
      duration: 150,
      ease: "Linear",
      onComplete: () => {
        this.heroCol = col;
        this.heroRow = row;
        this.remainingMoves -= TERRAIN_COST[this.terrainAt(col, row)];
        this.movesText.setText(`Moves: ${this.remainingMoves}`);
        const randomP = this.registry.get("randomPotions") as Array<{ col: number; row: number }> | undefined;
        const potionList = randomP ?? POTIONS;
        const potion = potionList.find(p => p.col === col && p.row === row);
        if (potion && !this.consumedPotions().has(`${col},${row}`)) {
          this.consumePotion(col, row);
          sfxPickup();
        }
        const randomS = this.registry.get("randomScrolls") as Array<{ col: number; row: number }> | undefined;
        const scrollList = randomS ?? SCROLLS;
        const scroll = scrollList.find(s => s.col === col && s.row === row);
        if (scroll && !this.consumedScrolls().has(`${col},${row}`)) {
          this.consumeScroll(col, row);
          sfxPickup();
        }
        const randomT = this.registry.get("randomTowns") as Array<{ col: number; row: number }> | undefined;
        const townList2 = randomT ?? TOWNS;
        const town = townList2.find(t => t.col === col && t.row === row);
        if (town) {
          this.visitTown(col, row);
        }
        this.animatePath(steps, index + 1);
      },
    });
  }

  private getHeroArmy(): HeroStackState[] {
    return this.registry.get("heroArmy") as HeroStackState[];
  }

  private getHeroHp(): number {
    return this.getHeroArmy().reduce((s, u) => s + u.currentHp, 0);
  }

  private getHeroXp(): number {
    return (this.registry.get("heroXp") as number | undefined) ?? 0;
  }

  private getHeroLevel(): number {
    return (this.registry.get("heroLevel") as number | undefined) ?? 1;
  }

  private getHeroMaxHp(): number {
    return this.getHeroArmy().reduce((s, u) => s + u.count * u.hpPerUnit, 0);
  }

  private hpColor(hp: number): string {
    const pct = hp / this.getHeroMaxHp();
    if (pct >= 0.6) return HP_COLOR_HIGH;
    if (pct >= 0.3) return HP_COLOR_MID;
    return HP_COLOR_LOW;
  }

  private terrainAt(col: number, row: number): Terrain {
    const random = this.registry.get("randomTerrain") as Record<string, Terrain> | undefined;
    if (random) return random[`${col},${row}`] ?? "grass";
    return TERRAIN_OVERRIDES[`${col},${row}`] ?? "grass";
  }

  static generateRandomTerrain(rng: () => number = Math.random): Record<string, Terrain> {
    // Cells we must NOT block: hero spawn (0,0), all enemy spawns, all pickups.
    const blocked = new Set<string>();
    blocked.add("0,0");
    for (const e of ENEMIES) blocked.add(`${e.col},${e.row}`);
    for (const p of POTIONS) blocked.add(`${p.col},${p.row}`);
    for (const s of SCROLLS) blocked.add(`${s.col},${s.row}`);

    const overrides: Record<string, Terrain> = {};
    const place = (terrain: Terrain, count: number) => {
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < count * 20) {
        attempts++;
        const col = Math.floor(rng() * COLS);
        const row = Math.floor(rng() * ROWS);
        const key = `${col},${row}`;
        if (blocked.has(key) || overrides[key]) continue;
        overrides[key] = terrain;
        placed++;
      }
    };
    place("water", 6 + Math.floor(rng() * 5)); // 6-10 water tiles
    place("forest", 8 + Math.floor(rng() * 6)); // 8-13 forest tiles
    return overrides;
  }

  // Generate random town positions (1 town like default), avoiding hero spawn, water, enemies, pickups.
  static generateRandomTowns(
    terrain?: Record<string, Terrain>,
    enemySpawns?: Array<{ col: number; row: number }>,
    pickups?: { potions: Array<{ col: number; row: number }>; scrolls: Array<{ col: number; row: number }> },
    rng: () => number = Math.random
  ): Array<{ col: number; row: number }> {
    const used = new Set<string>();
    used.add("0,0");
    if (enemySpawns) for (const e of enemySpawns) used.add(`${e.col},${e.row}`);
    if (pickups) {
      for (const p of pickups.potions) used.add(`${p.col},${p.row}`);
      for (const s of pickups.scrolls) used.add(`${s.col},${s.row}`);
    }
    const out: Array<{ col: number; row: number }> = [];
    let attempts = 0;
    while (out.length < TOWNS.length && attempts < 200) {
      attempts++;
      const col = Math.floor(rng() * COLS);
      const row = Math.floor(rng() * ROWS);
      const key = `${col},${row}`;
      if (used.has(key)) continue;
      if (terrain && terrain[key] === "water") continue;
      used.add(key);
      out.push({ col, row });
    }
    return out;
  }

  // Generate random pickup positions (potions + scrolls) avoiding hero spawn and water tiles.
  static generateRandomPickups(
    terrain?: Record<string, Terrain>,
    enemySpawns?: Array<{ col: number; row: number }>,
    rng: () => number = Math.random
  ): { potions: Array<{ col: number; row: number }>; scrolls: Array<{ col: number; row: number }> } {
    const used = new Set<string>();
    used.add("0,0");
    if (enemySpawns) for (const e of enemySpawns) used.add(`${e.col},${e.row}`);
    const pick = (count: number): Array<{ col: number; row: number }> => {
      const out: Array<{ col: number; row: number }> = [];
      let attempts = 0;
      while (out.length < count && attempts < count * 30) {
        attempts++;
        const col = Math.floor(rng() * COLS);
        const row = Math.floor(rng() * ROWS);
        const key = `${col},${row}`;
        if (used.has(key)) continue;
        if (terrain && terrain[key] === "water") continue;
        used.add(key);
        out.push({ col, row });
      }
      return out;
    };
    return { potions: pick(POTIONS.length), scrolls: pick(SCROLLS.length) };
  }

  // Generate random spawn positions for each enemy, avoiding hero spawn,
  // pickups, and any provided terrain overrides (so enemies don't spawn on water).
  static generateRandomEnemySpawns(terrain?: Record<string, Terrain>, rng: () => number = Math.random): Array<{ col: number; row: number }> {
    const used = new Set<string>();
    used.add("0,0");
    // Keep at least 3 hops away from hero spawn so the player has breathing room
    for (let dc = -2; dc <= 2; dc++) {
      for (let dr = -2; dr <= 2; dr++) {
        used.add(`${dc},${dr}`);
      }
    }
    for (const p of POTIONS) used.add(`${p.col},${p.row}`);
    for (const s of SCROLLS) used.add(`${s.col},${s.row}`);

    const result: Array<{ col: number; row: number }> = [];
    for (let i = 0; i < ENEMIES.length; i++) {
      let attempts = 0;
      while (attempts < 200) {
        attempts++;
        const col = Math.floor(rng() * COLS);
        const row = Math.floor(rng() * ROWS);
        const key = `${col},${row}`;
        if (used.has(key)) continue;
        if (terrain && terrain[key] === "water") continue;
        used.add(key);
        result.push({ col, row });
        break;
      }
      if (result.length <= i) {
        // Fallback to default spawn if random placement failed
        result.push({ col: ENEMIES[i]!.col, row: ENEMIES[i]!.row });
      }
    }
    return result;
  }

  private isPassable(col: number, row: number): boolean {
    return this.terrainAt(col, row) !== "water";
  }

  private dijkstraPath(
    fromCol: number,
    fromRow: number,
    toCol: number,
    toRow: number
  ): Hex[] {
    if (!this.isPassable(toCol, toRow)) return [];
    const dist = new Map<string, number>();
    const prev = new Map<string, Hex>();
    const startKey = `${fromCol},${fromRow}`;
    dist.set(startKey, 0);
    const queue: Array<{ key: string; col: number; row: number; d: number }> = [
      { key: startKey, col: fromCol, row: fromRow, d: 0 },
    ];
    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const u = queue.shift()!;
      if (u.col === toCol && u.row === toRow) break;
      if (u.d > (dist.get(u.key) ?? Infinity)) continue;
      for (const nb of this.hexNeighbors(u.col, u.row)) {
        if (!this.isPassable(nb.col, nb.row)) continue;
        const cost = TERRAIN_COST[this.terrainAt(nb.col, nb.row)];
        const nk = `${nb.col},${nb.row}`;
        const newD = u.d + cost;
        if (newD < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, newD);
          prev.set(nk, { col: u.col, row: u.row });
          queue.push({ key: nk, col: nb.col, row: nb.row, d: newD });
        }
      }
    }
    const target = `${toCol},${toRow}`;
    if (!prev.has(target) && startKey !== target) return [];
    const path: Hex[] = [];
    let cur: Hex = { col: toCol, row: toRow };
    while (`${cur.col},${cur.row}` !== startKey) {
      path.unshift(cur);
      cur = prev.get(`${cur.col},${cur.row}`)!;
    }
    return path;
  }

  private truncatePathToBudget(path: Hex[], budget: number): Hex[] {
    const taken: Hex[] = [];
    let spent = 0;
    for (const step of path) {
      const cost = TERRAIN_COST[this.terrainAt(step.col, step.row)];
      if (spent + cost > budget) break;
      spent += cost;
      taken.push(step);
    }
    return taken;
  }

  private bfsDistance(fromCol: number, fromRow: number, toCol: number, toRow: number): number {
    if (fromCol === toCol && fromRow === toRow) return 0;
    const visited = new Set<string>([`${fromCol},${fromRow}`]);
    let frontier: Hex[] = [{ col: fromCol, row: fromRow }];
    let dist = 0;
    while (frontier.length > 0) {
      dist++;
      const next: Hex[] = [];
      for (const { col, row } of frontier) {
        for (const nb of this.hexNeighbors(col, row)) {
          if (nb.col === toCol && nb.row === toRow) return dist;
          if (!this.isPassable(nb.col, nb.row)) continue;
          const k = `${nb.col},${nb.row}`;
          if (!visited.has(k)) {
            visited.add(k);
            next.push(nb);
          }
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  private shootHero(enemy: LiveEnemy): void {
    const { x: ex, y: ey } = this.hexCenter(enemy.col, enemy.row);
    const { x: hx, y: hy } = this.hexCenter(this.heroCol, this.heroRow);

    const line = this.add
      .line(0, 0, ex, ey, hx, hy, 0xffff44)
      .setOrigin(0, 0)
      .setDepth(50)
      .setLineWidth(2);

    this.tweens.add({ targets: line, alpha: 0, duration: 200, onComplete: () => line.destroy() });

    this.time.delayedCall(120, () => {
      const damage = Phaser.Math.Between(enemy.data.damageMin, enemy.data.damageMax ?? enemy.data.damageMin);
      const army = this.getHeroArmy();
      let remaining = damage;
      for (const stack of army) {
        if (stack.currentHp > 0 && remaining > 0) {
          const taken = Math.min(stack.currentHp, remaining);
          stack.currentHp -= taken;
          remaining -= taken;
        }
      }
      const newHp = this.getHeroHp();
      this.registry.set("heroHp", newHp);
      this.heroHpLabel.setText(`HP: ${newHp}/${this.getHeroMaxHp()}`);
      this.heroHpLabel.setStyle({ color: this.hpColor(newHp) });

      const dmgText = this.add
        .text(hx, hy - 30, `-${damage}`, { fontSize: "28px", color: "#cc4444" })
        .setOrigin(0.5)
        .setDepth(60);
      this.tweens.add({ targets: dmgText, y: hy - 60, alpha: 0, duration: 600, onComplete: () => dmgText.destroy() });

      if (newHp <= 0) {
        this.registry.set("heroArmy", freshArmy());
        this.registry.set("heroHp", this.getHeroHp());
        this.heroCol = 0;
        this.heroRow = 0;
        this.saveProgress();
        this.scene.start("MapScene", { heroHp: HERO_HP });
      }
    });
  }

  private consumedPotions(): Set<string> {
    return this.registry.get("consumedPotions") as Set<string>;
  }

  private consumedScrolls(): Set<string> {
    return this.registry.get("consumedScrolls") as Set<string>;
  }

  private applyXpGain(amount: number): void {
    let xp = this.getHeroXp() + amount;
    let level = this.getHeroLevel();
    while (level < LEVELS.length) {
      const threshold = LEVEL_THRESHOLDS[level];
      if (threshold === undefined || xp < threshold) break;
      level++;
      const army = this.getHeroArmy();
      for (const stack of army) {
        stack.count += 1;
        stack.currentHp += stack.hpPerUnit;
      }
    }
    this.registry.set("heroXp", xp);
    this.registry.set("heroLevel", level);
    this.registry.set("heroHp", this.getHeroHp());
  }

  private consumeScroll(col: number, row: number): void {
    const key = `${col},${row}`;
    this.consumedScrolls().add(key);

    this.applyXpGain(3);

    const hp = this.getHeroHp();
    const maxHp = this.getHeroMaxHp();
    const level = this.getHeroLevel();
    const xp = this.getHeroXp();

    this.heroHpLabel.setText(`HP: ${hp}/${maxHp}`);
    this.heroHpLabel.setStyle({ color: this.hpColor(hp) });

    const nextThreshold = LEVEL_THRESHOLDS[level];
    const xpText = nextThreshold !== undefined ? `Lvl ${level} • XP: ${xp}/${nextThreshold}` : `Lvl ${level} • MAX`;
    this.heroXpLabel.setText(xpText);

    const armyFirstStack = this.getHeroArmy()[0]!;
    this.heroDmgLabel.setText(`DMG: ${armyFirstStack.damageMin}-${armyFirstStack.damageMax}`);

    const { x: cx, y: cy } = this.hexCenter(col, row);
    const xpFloatText = this.add
      .text(cx, cy, "+3 XP", { fontSize: "20px", color: "#4488cc" })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: xpFloatText,
      y: cy - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => xpFloatText.destroy(),
    });

    const sprite = this.scrollSprites.get(key);
    if (sprite) {
      sprite.destroy();
      this.scrollSprites.delete(key);
    }

    this.saveProgress();
  }

  private visitTown(col: number, row: number): void {
    // Fully heal all hero stacks (towns are not consumed)
    const army = this.getHeroArmy();
    let healed = false;
    for (const stack of army) {
      const stackMax = stack.count * stack.hpPerUnit;
      if (stack.currentHp < stackMax) {
        stack.currentHp = stackMax;
        healed = true;
      }
    }
    if (!healed) return;
    this.registry.set("heroArmy", army);
    const newHp = this.getHeroHp();
    this.registry.set("heroHp", newHp);
    this.heroHpLabel.setText(`HP: ${newHp}/${this.getHeroMaxHp()}`);
    this.heroHpLabel.setStyle({ color: this.hpColor(newHp) });

    const { x: cx, y: cy } = this.hexCenter(col, row);
    const healText = this.add
      .text(cx, cy - 40, "FULL HEAL", { fontSize: "18px", color: "#88ccff", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: healText,
      y: cy - 90,
      alpha: 0,
      duration: 1200,
      onComplete: () => healText.destroy(),
    });
    this.saveProgress();
  }

  private consumePotion(col: number, row: number): void {
    const key = `${col},${row}`;
    this.consumedPotions().add(key);

    const army = this.getHeroArmy();
    let remainingHeal = 5;
    for (const stack of army) {
      const stackMax = stack.count * stack.hpPerUnit;
      if (stack.currentHp < stackMax && remainingHeal > 0) {
        const added = Math.min(remainingHeal, stackMax - stack.currentHp);
        stack.currentHp += added;
        remainingHeal -= added;
      }
    }
    const newHp = this.getHeroHp();
    this.registry.set("heroHp", newHp);
    this.heroHpLabel.setText(`HP: ${newHp}/${this.getHeroMaxHp()}`);
    this.heroHpLabel.setStyle({ color: this.hpColor(newHp) });

    const { x: cx, y: cy } = this.hexCenter(col, row);
    const healText = this.add
      .text(cx, cy, "+5 HP", { fontSize: "20px", color: "#44cc44" })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: healText,
      y: cy - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => healText.destroy(),
    });

    const sprite = this.potionSprites.get(key);
    if (sprite) {
      sprite.destroy();
      this.potionSprites.delete(key);
    }

    this.saveProgress();
  }

  private showEnemyTooltip(enemy: Enemy, sprite: Phaser.GameObjects.Arc): void {
    this.hideEnemyTooltip();

    const lines: Array<{ text: string; color: string }> = [
      { text: enemy.name, color: "#ffcc44" },
      { text: `HP: ${enemy.stackCount * enemy.hpPerUnit}`, color: "#ffffff" },
      { text: `DMG: ${enemy.damageMin}-${enemy.damageMax}`, color: "#ffffff" },
    ];
    if (enemy.range !== undefined) {
      lines.push({ text: `RANGE: ${enemy.range}`, color: "#ffffff" });
    }
    if (enemy.movesPerTurn > 1) {
      lines.push({ text: `SPEED: ${enemy.movesPerTurn}`, color: "#ffffff" });
    }

    const lineH = 16;
    const padX = 6;
    const padY = 6;
    const tooltipW = 140;
    const tooltipH = lines.length * lineH + padY * 2;

    const container = this.add.container(sprite.x + 80, sprite.y - 30);
    container.setDepth(200);

    const bg = this.add.rectangle(0, 0, tooltipW, tooltipH, 0x111111)
      .setAlpha(0.9)
      .setStrokeStyle(1, 0x444444)
      .setOrigin(0, 0);
    container.add(bg);

    lines.forEach(({ text, color }, i) => {
      const t = this.add.text(padX, padY + i * lineH, text, { fontSize: "12px", color }).setOrigin(0, 0);
      container.add(t);
    });

    this.activeTooltip = container;
  }

  private hideEnemyTooltip(): void {
    if (this.activeTooltip) {
      this.activeTooltip.destroy();
      this.activeTooltip = undefined;
    }
  }

  private hexNeighbors(col: number, row: number): Hex[] {
    const offsets: [number, number][] =
      row % 2 === 0
        ? [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
        : [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];
    return offsets
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter(({ col: c, row: r }) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
  }

  private hexCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.startX + col * this.colStep + (row % 2 === 1 ? this.colStep / 2 : 0),
      y: this.startY + row * this.rowStep,
    };
  }

  private hexPointsRelative(r: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      pts.push(r * Math.cos(angle), r * Math.sin(angle));
    }
    return pts;
  }
}
