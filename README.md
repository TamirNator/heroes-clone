# Heroes Clone

[![CI](https://github.com/TamirNator/heroes-clone/actions/workflows/ci.yml/badge.svg)](https://github.com/TamirNator/heroes-clone/actions/workflows/ci.yml)

A small Heroes 3-style turn-based strategy game built with TypeScript, Phaser 3, and Vite. Walk a hero across a hex map with terrain, fight a varied roster of enemies in a side-view combat scene, level up, collect potions and scrolls, defeat them all to win.

## Gameplay (v1.0)

### Map

- **20×15 pointy-top hex grid** with three terrain types:
  - **Grass** (dark slate) — walkable, costs 1 movement
  - **Forest** (dark green) — walkable, costs **2 movement** (Dijkstra prefers grass)
  - **Water** (dark blue) — **impassable**
- Hover any hex to highlight it. Hovering an enemy shows a tooltip with name, HP, damage range, and (for special enemies) range/speed.

### Hero

- Gold circle, starts at (0, 0) top-left.
- Click any reachable hex to walk there using cost-aware Dijkstra pathfinding.
- **5 movement points per turn** — terrain costs subtract from the budget. `End Turn` refreshes.
- **Persistent HP** between combats (currently `N/M` displayed top-right; color-coded green/yellow/red).
- **XP and levels:** earn XP for each combat victory; cross thresholds to level up (max HP and damage range increase). Level table: L1 (10 HP, 1–3 dmg), L2 (13, 2–4), L3 (17, 2–5), L4 (22, 3–6).

### Enemies (6 total)

| Name | Spawn | HP | Damage | Speed | XP |
|---|---|---|---|---|---|
| Goblin | (4, 4) | 3 | 1 | 1 | 2 |
| Orc | (10, 7) | 5 | 1–2 | 1 | 4 |
| Troll | (15, 11) | 8 | 2–3 | 1 | 7 |
| Wolf | (5, 11) | 4 | 1–2 | **2** | 3 |
| Wolf | (12, 2) | 4 | 1–2 | **2** | 3 |
| Archer | (8, 12) | 3 | 1–2 | 1 (range **3**) | 4 |

- **Wolves** (orange-red) move 2 tiles per turn — harder to outrun.
- **Archer** (yellow-gold) shoots from up to 3 hops away during the enemy turn — damages hero HP on the map without entering combat.
- All other enemies must reach the hero's hex to fight.

### Combat (side-view scene)

- Hero (gold) on the left, enemy stack (red/orange/yellow) on the right.
- HP bars + numeric labels for both. Color-coded by side.
- Click `Attack` — hero **lunges** toward the enemy, deals random damage at impact, defender **shakes**, floating `-N` damage text rises and fades. Enemy retaliates 400ms later with the same animation flow.
- `VICTORY!` (green) — removes enemy permanently, awards XP, hero takes the enemy's hex on return.
- `DEFEAT` (red) — full reset of hero HP and position; defeated enemies stay defeated.

### Pickups on the map

- **HP Potions** — 3 green `+` icons at fixed grass tiles. Walk onto one to heal **+5 HP** (capped at max). Permanently consumed.
- **XP Scrolls** — 2 blue `B` icons at fixed grass tiles. Walk onto one to gain **+3 XP** (level-up triggers if threshold crossed).

### Win + persistence

- Defeat **all 6 enemies** to see `GAME WON!` overlay → `New Game` button restarts everything fresh.
- All progress (defeated enemies, consumed pickups, hero HP/XP/level/position, remaining moves) is **saved to `localStorage`** — refresh the page and the run continues. The red `Reset` button (top-right) wipes the save.

## Stack

- TypeScript (strict mode, `noUncheckedIndexedAccess`)
- Phaser 3.90
- Vite
- Playwright (e2e tests)

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

Seven Playwright e2e tests cover every interactive flow:

| Spec | What it verifies |
|---|---|
| `e2e/s4-0-encounter.spec.ts` | Walking onto an enemy triggers the Combat scene |
| `e2e/s4-1-defeat.spec.ts` | Victory removes the enemy and places the hero on its hex |
| `e2e/s5-0-combat-layout.spec.ts` | Hero/enemy stacks render with HP labels |
| `e2e/s5-1-combat-attack.spec.ts` | Attack/retaliate loop ends in `VICTORY!` |
| `e2e/s6-0-multi-enemies.spec.ts` | Three enemies render; sequential defeats persist |
| `e2e/s6-1-game-won.spec.ts` | All-enemies-defeated triggers `GAME WON!` overlay; New Game resets |
| `e2e/s6-2-enemy-variation.spec.ts` | Each enemy passes its own name/HP/damage to the combat scene |
| `e2e/s6-3-random-damage.spec.ts` | Damage rolls vary; pinned rolls give predictable victories |
| `e2e/s7-0-enemy-ai.spec.ts` | Enemies move toward hero on End Turn; AI can reach hero → trigger combat |
| `e2e/s7-1-save-load.spec.ts` | Defeats persist to localStorage across page reload; Reset clears |

The tests inject `window.__game` (only in dev) to introspect Phaser scene state.

## Project structure

```
src/
  main.ts                 Phaser game config + scene registration
  scenes/
    BootScene.ts          (legacy) splash scene, no longer the start scene
    MapScene.ts           Hex grid, hero, movement, encounter trigger, win overlay
    CombatScene.ts        Stack visual, attack loop, victory/defeat outcomes
e2e/                      Playwright specs
playwright.config.ts      Test runner config
PROGRESS.md               Slice-by-slice changelog of how the game was built
```

## Development log

See `PROGRESS.md` for the slice-by-slice history (what each step added, what bugs were found, how they were fixed).

## Possible next steps (post-1.0)

- **Multi-stack combat** — multiple unit types per side (Heroes-3 style "stacks of N units"). The biggest deferred feature.
- **Towns** — recruit units to your stacks; refill HP at a town tile.
- **Procedural map generation** — randomize enemy / terrain / pickup placement each `New Game` for replayability.
- **Equipment & spells** — items dropped by enemies, spell book with cast options in combat.
- **Sound effects** — hit, victory, footstep, ambient.
- **Difficulty selection** — easy / normal / hard scaling enemy stats.
