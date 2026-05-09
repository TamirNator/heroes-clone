# Heroes Clone

[![CI](https://github.com/TamirNator/heroes-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/TamirNator/heroes-clone/actions/workflows/ci.yml)

A small Heroes 3-style turn-based strategy game built with TypeScript, Phaser 3, and Vite. Walk a hero across a hex map with terrain, fight a varied roster of enemies in a side-view combat scene, level up your unit stacks, collect potions and scrolls, defeat all enemies to win. Random map generator gives every playthrough a different layout.

## Gameplay (v1.5)

### Title screen

- `Continue` — resume from `localStorage` save (only shown if a save exists)
- `New Game` — fixed map (the same Goblin/Orc/Troll/Wolves/Archer layout every time)
- `Random Game` — procedurally generated terrain (6–10 water + 8–13 forest tiles) and randomly placed enemies (with a 5×5 buffer around hero spawn)
- `About` — short blurb modal

### Map

- **20×15 pointy-top hex grid** with three terrain types:
  - **Grass** (dark slate) — walkable, costs 1 movement
  - **Forest** (dark green) — walkable, costs **2 movement** (Dijkstra prefers grass)
  - **Water** (dark blue) — **impassable**
- Hover any hex to highlight it. Hovering an enemy shows a tooltip with its name, HP, damage range, and (where relevant) range/speed.
- Press **`H`** (or **`?`**) to toggle an in-game help overlay listing all controls.
- Top-right HUD: Moves remaining, End Turn / Reset buttons, color-coded HP, Lvl + XP, DMG range, enemies remaining (`N/6`).

### Hero

- Gold circle, starts at (0, 0) top-left.
- Click any reachable hex to walk there using cost-aware **Dijkstra** pathfinding.
- **5 movement points per turn** — terrain costs subtract from the budget. `End Turn` refreshes (and triggers the enemy turn).
- **Persistent HP** between combats (`HP: N/M` shown top-right; color-coded green ≥60% / yellow 30–59% / red <30%).
- **XP and levels:** earn XP for each combat victory or scroll pickup; cross thresholds to level up. Each level grants `+1` to every army stack's count plus a `hpPerUnit` heal. Level table:
  - L1: 10 HP, 1–3 dmg (default Swordsmen + Archers)
  - L2: +13 max, 2–4 dmg
  - L3: +17 max, 2–5 dmg
  - L4: +22 max, 3–6 dmg

### Hero army (multi-stack combat)

The hero is **two unit stacks** in combat:

- **Swordsmen** — count 5, HP 4/unit, damage 1–3
- **Archers** — count 4, HP 2/unit, damage 2–4

Click either stack's circle (or press `1` / `2`) to select it as the active attacker. The active stack shows a thick yellow outline. Each level-up gives every stack `+1` count and heals the new units.

### Enemies (6 total, default map)

| Name | Spawn | Stack | HP/unit | Damage | Speed | Special | XP |
|---|---|---|---|---|---|---|---|
| Goblin | (4, 4) | x3 | 1 | 1 | 1 | — | 2 |
| Orc | (10, 7) | x5 | 1 | 1–2 | 1 | — | 4 |
| Troll | (15, 11) | x4 | 2 | 2–3 | 1 | — | 7 |
| Wolf | (5, 11) | x2 | 2 | 1–2 | **2** | — | 3 |
| Wolf | (12, 2) | x2 | 2 | 1–2 | **2** | — | 3 |
| Archer | (8, 12) | x3 | 1 | 1–2 | 1 | range **3** | 4 |

- **Wolves** (orange-red) move 2 tiles per turn — harder to outrun.
- **Archer** (yellow-gold) shoots from up to 3 hops away during the enemy turn — damages hero HP on the map without entering combat.
- Each enemy renders as **multiple circles** in combat (one per surviving unit); rightmost circles disappear as units die.
- All other enemies must reach the hero's hex to fight.

### Combat (side-view scene)

- **Two hero stacks** on the left (Swordsmen + Archers) with their own HP bars and `xN` counts; **enemy stack** on the right rendered as N circles.
- `Attack` — active hero stack lunges, deals random damage at impact, defender shakes, dying units burst into puffs and trigger a **camera shake** scaled by kill count, floating `-N` damage text rises and fades. Enemy retaliates after a delay against the active stack.
- `AUTO` — toggle continuous attack (button turns green) until combat ends.
- `Speed: 1×/2×/4×` — cycles combat animation speed.
- **Combat log** at the bottom shows the last six events.
- **Round counter** under the `VS` text increments after each full hero+enemy exchange.
- Keyboard shortcuts (combat focus): `A` Attack, `O` toggle Auto, `1`/`2` select stack, `ESC` Return.
- `VICTORY!` (green) — removes enemy permanently, awards XP, hero takes the enemy's hex on return; brief outcome banner shown on map.
- `DEFEAT` (red) — full reset of hero HP and position; defeated enemies stay defeated (registry persists).

### Pickups on the map

- **HP Potions** — green `+` icons. Walk onto one to heal **+5 HP** (capped at max). Permanently consumed.
- **XP Scrolls** — blue `B` icons. Walk onto one to gain **+3 XP** (level-up triggers if threshold crossed).

### Win + persistence

- Defeat **all 6 enemies** to see `GAME WON!` overlay → `New Game` button restarts everything.
- All progress (defeated enemies, consumed pickups, hero HP/XP/level/army/position, remaining moves, random map data) is **saved to `localStorage`** — refresh the page and the run continues. The red `Reset` button (top-right) wipes the save.

## Stack

- TypeScript (strict mode, `noUncheckedIndexedAccess`)
- Phaser 3.90
- Vite
- Playwright (e2e tests, sequential `workers: 1`)

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/` in a browser.

## Development scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Serve the built bundle |
| `npm run test:e2e` | Run the Playwright e2e suite (auto-spawns dev server) |

## Tests

54 Playwright e2e tests cover every interactive flow — encounter trigger, defeat outcome, combat layout, attack loop, multi-enemy persistence, game-won state, enemy variation, random damage, AI movement, save/load, HP bars, hero army, enemy multi-stack rendering, animations (lunge/shake/puff/log/round/auto/keyboard), title scene, help overlay, combat speed slider, random map generator. Tests inject `window.__game` (only in dev) to introspect Phaser scene state, skip the title screen via `?nointro` query param, and run sequentially to avoid state-sharing flakes.

## Project structure

```
src/
  main.ts                 Phaser game config + scene registration
  scenes/
    TitleScene.ts         Continue / New Game / Random Game / About
    BootScene.ts          (legacy) splash scene, unused
    MapScene.ts           Hex grid, terrain, hero army, enemies, AI, pickups, save/load, win
    CombatScene.ts        Multi-stack combat, animations, log, AUTO, speed, keyboard
e2e/                      Playwright specs (54 tests, sequential)
.github/workflows/ci.yml  GitHub Actions: tsc + build + e2e on push/PR
playwright.config.ts      Test runner config (workers: 1, webServer auto-spawn)
PROGRESS.md               Slice-by-slice changelog of how the game was built
```

## Development log

See `PROGRESS.md` for the slice-by-slice history (what each step added, what bugs were found, how they were fixed). The project shipped through tagged milestones `v0.2.0` → `v0.3.0` → `v0.3.1` → `v0.4.0` → `v0.5.0` → `v0.6.0` → `v0.7.0` → `v1.0.0` → `v1.1.0` → `v1.2.0` → `v1.3.0` → `v1.4.0` → `v1.5.0` over many short slices, each tested headlessly via Playwright + screenshot inspection before merge.

## Possible next steps

- **Towns** — recruit units to your stacks; refill HP at a town tile
- **Equipment & spells** — items dropped by enemies, spell book with cast options in combat
- **Sound effects** — hit, victory, footstep, ambient
- **Difficulty selection** — easy / normal / hard scaling enemy stats
- **Mobile-responsive scaling** — Phaser `scale.FIT` (deferred — would require updating click coords in all 16 click-position tests)
