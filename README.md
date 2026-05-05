# Heroes Clone

A small Heroes 3-style turn-based strategy game built with TypeScript, Phaser 3, and Vite. Walk a hero across a hex map, fight enemies in a side-view combat scene, defeat all 3 to win.

## Gameplay (v0.2)

- **Hex map** — 20×15 pointy-top hex grid; hover to highlight tiles.
- **Hero** — gold circle, starts at top-left. Click any reachable hex to walk there.
- **Movement budget** — 5 moves per turn, BFS pathfinding decides the route, `End Turn` refreshes.
- **Three enemies on the map**:
  - **Goblin** at (4, 4) — HP 3, damage 1
  - **Orc** at (10, 7) — HP 5, damage 1
  - **Troll** at (15, 11) — HP 8, damage 2
- **Combat** — walking onto an enemy hex flips to a side-view combat scene. Click `Attack` to deal damage; the enemy retaliates each round until one side dies.
- **Outcomes** — `VICTORY!` removes the enemy from the map permanently; the hero takes the enemy's hex on return. `DEFEAT` resets the run (defeated enemies stay defeated thanks to the Phaser game registry).
- **Win condition** — defeat all three enemies to see `GAME WON!`. The `New Game` button clears progress and starts over.

The difficulty curve is tight: fighting in order (Goblin → Orc → Troll) leaves the hero at HP 1 after the Troll. Out-of-order fights are likely fatal.

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

## Possible next steps

- **Random damage** — replace deterministic damage with rolled ranges (e.g. Hero 1–3, Orc 1–2). Tests would need a seedable RNG.
- **HP bars** — visual bar instead of/alongside the `HP: N` text.
- **Damage numbers** — floating `-2` text that fades up when a stack takes damage.
- **More enemies / map variety** — random enemy placement, different terrain types, impassable tiles.
- **Enemy AI on the map** — enemies move toward the hero each turn.
- **Towns / treasures** — pickup tiles that grant gold or HP.
- **Save/load** — persist registry to `localStorage` so progress survives reload.
