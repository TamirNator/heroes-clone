# Heroes Clone — Progress Log

Stack: TypeScript + Phaser 3 + Vite. PM/orchestrator: Claude Code (this terminal). Coder + QA: separate `claude` CLI sessions in their own Terminal windows.

---

## C0 — Cleanup: downgrade Phaser 4 → 3
**Coder:** package.json now `phaser: "^3.80.0"`, installed `phaser@3.90.0`. No `src/` edits needed (existing code already valid Phaser 3). `npm run build` ok (chunk warning only). Dev server served HTML.
**QA:** FAIL on methodology (correct call). Code-level checks all PASS. Failed because (1) no git baseline → diff scope unverifiable; (2) `PROGRESS.md` added by PM outside coder's file allow-list with no audit trail.
**PM action:** create baseline commit covering S1+C0+PROGRESS.md so future slices have a clean diff origin. Future slices: coder/QA must respect the committed baseline.
**Status:** ✅ code GREEN, audit gap closed by baseline commit `4eae361`.

---

## INFRA — Playwright e2e testing
**Goal:** PM owns verification. Stop asking the user to do click tests.
**Setup:** `@playwright/test` v1.59.1 + Chromium binary. `playwright.config.ts` with auto-spawned Vite dev server, `baseURL` http://localhost:5173, viewport 1400×800, screenshot-on-failure, trace-on-failure. `npm run test:e2e` runs the suite. `e2e/` dir for tests. `playwright-report/` and `test-results/` gitignored.
**Hook for tests:** `src/main.ts` exposes `window.__game` in `import.meta.env.DEV` only — production builds don't leak Phaser internals. Tests read scene state via `g.scene.getScenes(true)` and find game objects by type (Rectangle, Arc, etc.) for click coords.
**First test:** `e2e/s4-0-encounter.spec.ts` — full encounter flow. Test teleports hero to (4,3) before clicking enemy at (4,4) since fresh-start budget (5) is shy of BFS distance from (0,0).
**Status:** ✅ infra in place; future slices add tests as needed.

---

## S12.0 — Combat lunge animations (v0.8 kickoff)
**Coder:** New `lungeAttack(attacker, onPeak, onLungeComplete?)` method. Hero attacks → sprite tweens +80px right with `Cubic.easeOut` over 100ms; on peak applies damage + spawns floating text; tweens back with `Cubic.easeIn` over 100ms. Enemy attack mirrors with -80px lunge. `isCombatAnimating` guard prevents click-spam. `onAttack`'s `onLungeComplete` schedules enemyAttack via existing 400ms delay.
**Verification:** new e2e `s12-0-combat-animation.spec.ts` checks sprite x changes mid-lunge then returns. All 36 tests pass (41.0s) — no existing test adjustments needed (damage still applies at lunge peak, well within all `waitForFunction` windows).
**Status:** ✅ shipped.

---

## S11.1 — XP scrolls (closes v0.7)
**Coder:** 2 scrolls at (12,8) and (5,6), grass-confirmed clear of enemies/water. Visual: bold blue `B` 28px depth 5. `registry["consumedScrolls"]` Set. Refactored: extracted level-up loop into `applyXpGain(amount)`, used by both combat-victory and scroll pickup. `consumeScroll` adds 3 XP, runs level-up, updates labels, spawns floating `+3 XP` blue text, destroys sprite, saves. Stored `heroXpLabel` as class field for in-place updates. SaveData extended. Reset/New Game clear.
**Verification:** new e2e `s11-1-scrolls.spec.ts` covers render, pickup-with-level-up (5 XP threshold), persistence, Reset clears. All 35 tests pass (36.2s).
**Status:** ✅ shipped — closes v0.7 (treasures: HP potions + XP scrolls).

---

## S11.0 — HP potions on map (v0.7 kickoff)
**Coder:** 3 potions at (7,9), (14,4), (3,10) — all grass. Visual: green `+` text 32px depth 5. `registry["consumedPotions"]` Set tracks pickups (lazy-init like defeatedEnemies). Pickup hook in `animatePath`'s post-step `onComplete`: if hero lands on a potion not yet consumed, calls `consumePotion(col,row)` which marks consumed, heals 5 HP capped at maxHp, spawns floating green `+5 HP` text, destroys the potion sprite, saves. SaveData extended with `consumed: string[]`. Reset/New Game clear.
**Verification:** new e2e `s11-0-potions.spec.ts` covers initial render, pickup heals + sprite removal, persistence across reload, Reset clears. All 32 tests pass (33.7s). PM verified 3 green crosses on initial map screenshot.
**Status:** ✅ shipped.

---

## S10.1 — Readability: enemy tooltip + hero damage label (closes v0.6)
**Coder:** Hero damage label (`DMG: min-max`) below XP label, recreated on level-up. Enemy tooltip on hover: gold name + HP + DMG, optional RANGE/SPEED rows for Archer/Wolves. Container at `(sprite.x+80, sprite.y-30)` depth 200. Click conflict resolved by NOT making enemy sprite interactive — instead, hex tile's existing `pointerover` looks up `liveEnemies` and triggers tooltip. Click events still flow to the polygon → `onHexClicked`. No risk of swallowing input.
**Verification:** new e2e `s10-1-readability.spec.ts` (DMG label text + tooltip render/destroy). All 29 tests pass (31.1s). PM verified screenshot showing tooltip on Goblin + hero stat panel.
**Status:** ✅ shipped — closes v0.6 (hero progression: XP/levels + stat readability).

---

## S10.0 — Hero XP + levels (v0.6 kickoff)
**Coder:** 4-level table: L1 (10HP, 1-3dmg), L2 (13, 2-4), L3 (17, 2-5), L4 (22, 3-6). Thresholds [0, 5, 12, 25] XP. Total XP from all 6 enemies = 23 → reaches L3. `Enemy.xpReward` added (Goblin 2, Orc 4, Troll 7, Wolf 3, Archer 4). `registry["heroXp"]` and `["heroLevel"]` join `heroHp` in persistent state. CombatScene victory passes `xpGained` to MapScene; init block applies XP, loops level-ups (heals delta on each), persists. CombatScene reads `heroDamageMin/Max` from initData (passed from level table) so damage scales with level. HP label format `HP: N/M` uses dynamic max. New XP label below: `Lvl N • XP: x/threshold` (or `MAX` at L4). Reset/New Game also reset XP and Level.
**Test updates:** `s9-1-persistent-hp.spec.ts` — Goblin+Orc defeats now trigger level-up so HP shows `10/13` instead of `7/10`. New `s10-0-progression.spec.ts` covers initial state + XP accumulation + level-up.
**Verification:** all 27 tests pass (31.4s). PM verified screenshot — `HP: 13/13`, `Lvl 2 • XP: 6/12` visible.
**Status:** ✅ shipped.

---

## S9.2 — Ranged enemy (Archer) — closes v0.5
**Coder:** Sixth enemy `Archer` at (8, 12), HP 3, damage 1-2, `range: 3`. Color `0xcccc44` (yellow-gold). New `bfsDistance` helper for hop-count range check (pure BFS, ignores cost). `runEnemyStep` checks `range !== undefined` and `bfsDistance ≤ range` — if yes, calls `shootHero` instead of moving. `shootHero`: spawns a yellow `Phaser.GameObjects.Line` from archer to hero, tweens alpha 1→0 over 200ms, after 120ms applies 1–2 damage to map-level `registry.heroHp`, updates HP label, spawns floating `-N`. If HP ≤ 0 from a shot: defeat — resets HP + position, scene.start with `heroHp: HERO_HP` (defeated enemies preserved per registry).
**Test updates:** s4-1, s6-0, s6-1, s7-1, s9-1 enemy counts adjusted from 5 → 6. New `s9-2-archer.spec.ts` covers (a) out-of-range Archer moves toward hero, (b) in-range Archer stays put and damages hero.
**Verification:** all 25 tests pass (28.7s).
**Status:** ✅ shipped — closes v0.5 (more enemy types: 3 melee + 2 fast + 1 ranged).

---

## S9.1 — Persistent hero HP between combats
**Coder:** Hero HP lives in `registry["heroHp"]`, lazy-init to 10. New top-right HP label below Reset, format `"HP: N/10"`, color-coded green ≥60% / yellow 30-59% / red <30%. Both scene-start calls to CombatScene now pass `heroHp`. CombatScene reads `initData.heroHp ?? HERO_HP`. Victory/Defeat/Return all pass `heroHp` back. Defeat sends `HERO_HP` (full reset). Save/load extended with `heroHp` field. Reset + New Game also reset HP to max.
**Why this matters:** before this slice, every combat started hero at full 10 HP — so the README's claim of a "tight difficulty curve" was actually false. Now fighting in order really does carry damage forward.
**Verification:** new e2e `e2e/s9-1-persistent-hp.spec.ts` covers full → reduced after fight → reduced further after second fight → reset after Reset. All 23 tests pass (25.2s). Screenshot shows hero on map with `HP: 7/10` after defeating two enemies.
**Status:** ✅ shipped.

---

## S9.0 — Fast enemy type (Wolves, v0.5 kickoff)
**Coder:** New `Wolf` type at (5,11) and (12,2). Stats: HP=4, dmg 1-2, **`movesPerTurn: 2`** (vs 1 for slow enemies). Visually orange-red `0xff8844` to distinguish from dark-red `0xcc4444` slows. `Enemy` type extended with `movesPerTurn`. `runEnemyStep(i)` now delegates to `runEnemyMultiStep(i, stepsRemaining)` which recursively does N hops per enemy, recomputing Dijkstra each step, checking for hero collision after each (combat triggers if hit).
**Test updates:** s4-1, s6-0, s6-1, s7-1 had counts updated for 5 enemies instead of 3. New e2e `s9-0-fast-enemy.spec.ts` asserts Wolf moves 2 BFS hops vs Goblin's 1 after one End Turn.
**Verification:** all 22 tests pass (23.9s). PM verified screenshot showing Wolves visibly closer to hero than slow enemies after one turn.
**Status:** ✅ shipped.

---

## S8.1 — Terrain movement cost + Dijkstra
**Coder:** `TERRAIN_COST = { grass: 1, forest: 2, water: Infinity }`. Replaced `bfsPath` with `dijkstraPath` (mutable priority queue, sorted by accumulated distance) — uniform-cost case still gives same paths. New `truncatePathToBudget(path, budget)` walks the path summing entry costs and returns only fully-affordable steps. Hero `animatePath` decrements `remainingMoves` by destination tile's cost per hop. Enemy AI still takes exactly one step per turn (no budget). Public `lastPath` exposed for test introspection.
**Net effect:** Dijkstra picks cheaper grass paths even when the forest direct-path is fewer hops, since 2×forest=4 > 4×grass=4 (tie) or worse. Players have to plan around forest patches.
**Verification:** new e2e `e2e/s8-1-terrain-cost.spec.ts` covers 3 cases (cost spending, budget truncation, path-prefers-grass). All 21 tests pass (21s). PM verified screenshot showing hero on a forest tile after a multi-hop walk.
**Status:** ✅ shipped — closes v0.4 (map variety).

---

## S8.0 — Terrain types + impassable tiles (v0.4 kickoff)
**Coder:** Three terrain types: **grass** `0x2a3a4a` (default, walkable, 282 tiles), **forest** `0x2d4a2d` (walkable, 10 tiles in 3 patches), **water** `0x1a3a5a` (impassable, 8 tiles in 2 barriers — diagonal upper-middle + vertical right side). `TERRAIN_OVERRIDES` map keyed by `"col,row"` provides per-tile lookup with grass fallback. Hover variants per terrain. `terrainAt(col,row)` + `isPassable(col,row)` helpers; `bfsPath()` filters neighbors by `isPassable` AND short-circuits if destination is impassable. Same BFS used by hero pathfinding and enemy AI, so neither can route through water.
**Verification:** new e2e `e2e/s8-0-terrain.spec.ts` (multiple sub-tests for terrain rendering, hero water-block, enemy AI water-block, pathing-around). All 18 e2e tests pass (20.1s). PM verified screenshot shows all 3 terrain types and barriers.
**Status:** ✅ shipped.

---

## S7.2 — HP bars in CombatScene
**Coder:** Each combatant has a 160×14 px bar centered below its circle and above the "HP: N" text. Background `0x222222` fill + `0x555555` stroke. Fill rectangle anchored `setOrigin(0, 0.5)` at left edge so it shrinks rightward; hero green `0x44cc44`, enemy red `0xcc4444`. Width formula `Math.max(0, currentHp/maxHp * 160)`. Updated in `onAttack()` (after enemy damage applied) and `enemyAttack()` (after hero damage applied). Hero maxHp = `HERO_HP` (10); enemy maxHp from `initData.enemyHp`. Bar Rectangles created AFTER buttons so the existing button-finding code in tests (`rects[0]`=Return, `rects[1]`=Attack) still works.
**Verification:** new e2e `e2e/s7-2-hp-bars.spec.ts` confirms initial widths (160/160) and post-attack widths (Troll 6/8 → 120, Hero 8/10 → 128). All 14 e2e tests pass (19.2s). PM verified screenshot showing bars at correct widths + bonus floating "-2" text from S6.3 captured mid-fade.
**Status:** ✅ shipped.

---

## S7.1 — Save/load progress to localStorage
**Coder:** Save shape `{ defeated: string[], heroCol, heroRow, remainingMoves }` written to `localStorage["heroes-clone:save"]`. Save triggers: post-hero movement, post-enemy turn, post-combat return, New Game (clear), Reset (clear). Load on `MapScene.create()` when there's no scene-transition `initData`. New "Reset" button (Rectangle 100×30 at top-right below End Turn, red stroke `0xcc4444` to signal destructive). Disabled while animating or game-won. Try/catch around all `localStorage` calls (private mode safety).
**Verification:** new e2e `e2e/s7-1-save-load.spec.ts` covers (a) defeat → reload → state restored, (b) Reset button → all enemies back, hero at (0,0), localStorage cleared. All 13 e2e tests pass (19.0s). PM verified screenshots: after-reload (2 enemies remain, hero at (4,4)), after-reset (clean map).
**Status:** ✅ shipped — game state survives page reload.

---

## S7.0 — Enemy AI movement on End Turn
**Coder:** Refactored `enemySprites: Map` → `liveEnemies: LiveEnemy[]` where `LiveEnemy = { col, row, data, sprite }`. The mutable `col`/`row` track current position (changes on AI move); `data` holds spawn info (used as the registry key for defeat tracking). Added `runEnemyTurn()` triggered by End Turn click after `remainingMoves` refresh: each living enemy in turn does BFS to hero, takes one tile step, animates 150ms. If an enemy lands on hero's hex, immediate `scene.start("CombatScene", ...)` with `originalCol/Row` (spawn) AND `enemyCol/Row` (current). CombatScene's victory/return paths use `originalCol ?? enemyCol` for the defeat registry key — so a defeated wandering enemy stays defeated even though it left its spawn.
**Test updates:** all 8 prior tests updated for `liveEnemies` shape (sprite lookups via `find`, size checks via `length`). `s7-0-enemy-ai.spec.ts` adds two tests: (a) verify enemy moves after End Turn, (b) End Turn 8–10× until Goblin reaches hero → CombatScene auto-triggers.
**Verification:** all 11 e2e tests pass (16.9s). PM verified screenshot showing all 3 enemies moved one tile closer to hero.
**Status:** ✅ shipped — game now meaningfully tactical, not just "walk to enemies".

---

## S6.3 — Random damage rolls + floating damage text
**Coder:** Replaced single `damage` field with `damageMin`/`damageMax` per enemy. Hero rolls 1–3, Goblin 1–1, Orc 1–2, Troll 2–3. CombatScene exposes public injectable RNG fields (`rollHeroDamage`, `rollEnemyDamage`) so e2e tests can pin to deterministic values via `page.evaluate`. Added floating damage text — `-N` rendered at the hit stack's coords, tweened up 40px and faded over 600ms, then destroyed.
**Test updates:** s5-1, s6-0, s6-1 now inject deterministic rolls (hero=2, enemy=1) after waiting for CombatScene; existing click counts unchanged. s6-2 asserts on `damageMin/Max` instead of `damage`. New `e2e/s6-3-random-damage.spec.ts` runs 100× rolls in-page to verify variance, plus a pinned-rolls case (hero=3, enemy=2 vs Troll → VICTORY in 3 hits, hero ends at 6 HP).
**Verification:** all 9 e2e tests pass (13.0s).
**Status:** ✅ shipped.

---

## S6.2 — Enemy variation (different stats per enemy)
**Coder:** Extended `Enemy` type with `name/hp/damage`. Three enemies: **Goblin** (4,4) HP 3 dmg 1, **Orc** (10,7) HP 5 dmg 1, **Troll** (15,11) HP 8 dmg 2. MapScene's encounter trigger looks up the matching enemy and passes full stats to CombatScene. CombatScene's `initData` extended with `enemyName/enemyHp/enemyDamage`. Stack label uses `enemyName`, HP label uses `enemyHp`, retaliation damage uses `enemyDamage` field (replaces removed constant `ENEMY_DAMAGE`). Hero unchanged (HP 10, damage 2).
**Difficulty curve (in given order):** Goblin → 2 hits, hero ends at 9. Orc → 3 hits, hero ends at 7. Troll → 4 hits, hero ends at 1. Tight but winnable.
**Test updates:** s5-0/s5-1/s6-0/s6-1 all updated for new stats; click counts adjusted (Goblin 2, Orc 3, Troll 4 attacks). New `e2e/s6-2-enemy-variation.spec.ts` verifies `initData.enemyName/Hp/Damage` for each of the 3 enemies.
**Verification:** all 7 e2e tests pass (11.2s). PM verified `s6-2-troll.png` shows "Troll" name + "HP: 8".
**Status:** ✅ shipped.

---

## S6.1 — Game-won state + New Game replay
**Coder:** Added `gameWon` field, `renderWinOverlay()` method. Win detection in `create()` after enemy render: if `defeatedEnemies.size >= ENEMIES.length`, render overlay. Overlay = translucent black Rectangle (alpha 0.7, depth 100) + "GAME WON!" 64px green + "All enemies defeated" subtitle + "New Game" button (200×50, green stroke, hover fill swap). New Game click clears the registry's defeated set + `scene.start("MapScene", {})`. **Bug fix bundled:** `scene.start("MapScene")` with no second argument was carrying the prior `init` data; explicit `{}` argument forces clean state. `onHexClicked` and End Turn `pointerdown` short-circuit when `gameWon` is true.
**Verification:** new e2e `e2e/s6-1-game-won.spec.ts` defeats all 3 enemies (mostly via registry pre-population for speed; final defeat via real click flow), verifies overlay, clicks New Game, verifies fresh state. All 6 e2e tests pass (11.3s). PM verified screenshots.
**Note:** mid-task the CODER hit a per-account quota limit ("usage resets at 3:50pm Asia/Jerusalem"). Resolved by retry; no work lost.
**Status:** ✅ shipped.

---

## S6.0 — Multiple enemies on map (with persistent defeat tracking)
**Coder:** Replaced single `ENEMY_COL/ROW` constants with `ENEMIES` array of 3 fixed positions: `(4,4)`, `(10,7)`, `(15,11)`. Defeated tracking moved to `Phaser.Game.registry` (game-wide, persists across `scene.start`): lazy-init `Set<string>` keyed by `"col,row"`. Replaced `enemySprite` field with `enemySprites: Map<string, Arc>`. Render loop skips defeated keys. Encounter trigger checks `enemySprites.has(heroKey)` and passes `{ enemyCol, enemyRow }` to CombatScene. CombatScene's `init(data)` stores enemy coords; `showOutcome(true)` (and Return) pass `{ defeatedCol, defeatedRow, heroCol, heroRow }`. MapScene's `init` adds defeated key to registry. On DEFEAT: full reset but registry preserves (so already-defeated enemies stay gone).
**Test adjustments:** existing s4-0/s4-1/s5-0/s5-1 tests updated to use `enemySprites.get('4,4')` instead of `enemySprite`.
**Verification:** new e2e `e2e/s6-0-multi-enemies.spec.ts` exercises 2 sequential defeats; all 5 e2e tests pass (10.1s). PM verified screenshots: initial (3 red dots), after-first-defeat (2 red dots, hero at (4,4)), after-second-defeat (1 red dot).
**Status:** ✅ shipped.

---

## S5.1 — Combat attack loop with victory/defeat
**Coder:** Added `HERO_DAMAGE=2`, `ENEMY_DAMAGE=1` constants. State fields `heroHp`, `enemyHp`, `combatOver`, plus refs `heroHpText`, `enemyHpText`, `attackBtn`. Attack button (Rectangle 140×40) at (320, 530) below hero stack. `onAttack()`: subtract HERO_DAMAGE from enemyHp (clamped to 0), update label; if enemy dies → dim button + `showOutcome(true)`; else schedule `enemyAttack()` after 400ms. `enemyAttack()`: subtract ENEMY_DAMAGE from heroHp; if hero dies → `showOutcome(false)`. `showOutcome()`: render large outcome text (VICTORY! green or DEFEAT red) at (640, 600), then after 1500ms `scene.start("MapScene", ...)` — victory passes `{defeated:true, heroCol:4, heroRow:4}`, defeat passes nothing (full reset).
**Deterministic combat:** Round 1: enemy 5→3, hero 10→9. Round 2: enemy 3→1, hero 9→8. Round 3: enemy 1→0 → VICTORY (no retaliation). Hero ends with 8 HP.
**Verification:** new e2e `e2e/s5-1-combat-attack.spec.ts` covers full attack→victory→return flow. All 4 e2e tests pass (5.8s). PM verified screenshots: mid-combat (HP:3), victory (green text, HP 8 vs 0), after-return (hero at (4,4), enemy gone).
**Status:** ✅ shipped.

---

## S5.0 — Combat scene visual stacks
**Coder:** Replaced placeholder "COMBAT" text with hero/enemy stack layout. Hero (gold Arc r=50, "Hero" label, "HP: 10" label) at x=320; enemy (red Arc r=50, "Enemy" label, "HP: 5" label) at x=960; "VS" text gray center. Constants `HERO_HP=10`, `ENEMY_HP=5`. Return button moved to top-left (120, 50) to clear combat area; still calls `scene.start("MapScene", { defeated: true, heroCol: 4, heroRow: 4 })`. No interaction yet.
**Verification:** new e2e `e2e/s5-0-combat-layout.spec.ts` — all 3 tests pass (3.8s). PM verified screenshot `test-results/s5-0-combat.png` shows correct layout.
**Status:** ✅ shipped.

---

## S4.1 — Defeat outcome (enemy removed, hero takes enemy's hex)
**Coder:** CombatScene's Return button now passes `{ defeated: true, heroCol: 4, heroRow: 4 }` via `scene.start("MapScene", data)`. MapScene gained `init(data)` lifecycle hook + `initData` field; `create()` reads it to (a) place hero at `(initData.heroCol ?? 0, initData.heroRow ?? 0)` and (b) skip enemy render when `initData.defeated === true`. `enemySprite` field is now optional. Encounter trigger guards on `this.enemySprite !== undefined`.
**Verification:** new e2e `e2e/s4-1-defeat.spec.ts` — both s4-0 and s4-1 tests pass (3.7s total). Screenshot `test-results/s4-1-after-return.png` confirms: hero at hex (4,4), enemy absent, Moves: 5.
**Status:** ✅ shipped — verified entirely without human eyeball test (Playwright + screenshot read by PM).

---

## S4.0 — Enemy on map + walk-onto-enemy triggers stub Combat scene
**Coder:** Added `ENEMY_COL=4`, `ENEMY_ROW=4` constants, `enemySprite` field; renders red `Arc` (fill `0xcc4444`, stroke `0x222222` w2, depth 10) at hex(4,4). Encounter trigger inside `animatePath`'s post-animation block (`index >= steps.length`): if hero coords match enemy coords, `scene.start("CombatScene")`. New `src/scenes/CombatScene.ts` (34 lines): dark `#1a0a0a` bg, "COMBAT" 64px gold centered, "Return to Map" Rectangle button → `scene.start("MapScene")`. `src/main.ts` registers CombatScene.
**QA (headless):** PASS — diff scope clean, deps unchanged, build/tsc/curl green, all spec items verified in source.
**E2E test (Playwright):** PASS first run; screenshots captured of MapScene → CombatScene → MapScene transitions.
**Bug found by visual screenshot inspection:** back-to-map showed `Moves: 4` (stale state). Root cause: Phaser reuses the same scene instance across `scene.start()` calls; field initializers don't re-run.
**Fix:** explicit reset of `heroCol/heroRow/remainingMoves/isAnimating` at top of `MapScene.create()`. E2E re-run: PASS, back-to-map now shows `Moves: 5`.
**Status:** ✅ shipped (with infra + fix).

---

## S3.2 — End Turn button
**Coder:** Added `endTurnBtn` (Rectangle 120×36 fill `0x2a3a4a` stroke `0xffcc44` w2, top-right at `(1260, 50)` with `setOrigin(1,0)`), centered "End Turn" text overlay, hover handler swaps fill, `pointerdown` triggers `endTurn()` which resets `remainingMoves = MOVEMENT_PER_TURN` and updates label. Button alpha → 0.5 while `isAnimating`, restored on tween complete. Click ignored during animation. Diff purely additive (+35 lines, no other code touched).
**QA:** PASS WITH FLAGS — flag invalid (QA misread history; thought polygon code was refactored, but that was already the S3.1 alignment fix in HEAD). Real verdict: PASS, no real issues.
**Eyeball test (PM-user):** visual confirmed (button renders, gold-bordered, below Moves label). Click behavior confirmed.
**Status:** ✅ shipped.

---

## S3.1 — Pathfinding + animated movement + movement budget
**Coder:** Added `MOVEMENT_PER_TURN=5`, BFS pathfinder over hex neighbors (row-parity offsets), recursive `animatePath` chained via `onComplete` (150ms/hop), `isAnimating` guard, "Moves: N" label top-right, click short-circuits when animating / out of moves / on hero's own hex. `MapScene.ts` 86 → 174 lines.
**QA:** PASS — diff scope clean, deps unchanged, build/tsc/curl green, all guards verified, BFS+predecessor reconstruction confirmed, tween chaining via onComplete confirmed, label updates per hop.
**Eyeball test (PM-user):** hero animated correctly but appeared visually off-center within its hex.
**Fix iterations (3 attempts — root-causing Phaser polygon rendering):**
1. Tried `polygon.getCenter()` as source of truth → made it WORSE (returns `(displayWidth/2, displayHeight/2)` ≈ `(30, 30)` for polygon at `(0,0)` with default origin).
2. Repositioned polygon to `(cx, cy)` with relative-coord points → still off (didn't account for `displayOrigin` shift in render path).
3. **Real fix:** Phaser's polygon renderer applies `displayOriginX/Y` to each vertex. With default origin `(0.5, 0.5)` and `setSize(hexW, 2r)`, the polygon's visual centroid lands at `(cx - hexW/2, cy - r)`, not `(cx, cy)`. Input system applies the same shift, which is why click-to-move always worked despite the visual mismatch. Solution: `poly.setOrigin(0)` zeroes displayOrigin so vertices render at `(cx+px, cy+py)` — visual centroid = `(cx, cy)` = hero anchor. Aligned.
**Status:** ✅ shipped (after 3 fix iterations).

---

## S3 — Hero token + click-to-teleport
**Coder:** Added gold hero circle (`r*0.45`, fill `0xffcc44`, stroke `0x222222` w2, depth 10) at hex (0,0). Added `pointerdown` on each tile → `moveHeroTo(col,row)` updates state + repositions sprite. Refactored grid constants into instance fields and extracted `hexCenter(col,row)` helper. `MapScene.ts` 60→86 lines.
**QA:** PASS — diff scope clean (only MapScene.ts), no dep changes, build/tsc/curl green, hero circle/stroke/depth present, `pointerdown` handler verified, hover still works, 300 tiles intact.
**Eyeball test (PM-user):** hero appears on (0,0), teleport works. PM-user noted hero looks slightly off-center on the hex — diagnosed as pointy-top visual quirk (hex bulk is in upper/lower tips; small circle at exact geometric center sits in the narrow waist). Ship as-is; revisit polish later if needed.
**Status:** ✅ shipped.

---

## S2 — Hex grid render with hover
**Coder:** Created `src/scenes/MapScene.ts` (60 lines, pointy-top hexes, COLS=20×ROWS=15=300 tiles). Modified `src/main.ts` (3 lines: import MapScene + add to scene list first).
**QA:** PASS on headless checks — diff scope clean, no dep changes, build/tsc/curl all green, 300 tiles, polygon hit area, pointerover/pointerout present, MapScene registered first.
**Eyeball test (PM-user):** Initial render had triangular gaps between hexes — wrong tiling math (used flat-top offset pattern with pointy-top geometry).
**S2-fix:** Coder rewrote layout: pointy-top with `colStep = √3·r`, `rowStep = 1.5·r`, odd ROWS offset horizontally by `colStep/2`. `r ≈ 29.57px` (height-constrained, 20px margins). Re-verified: build/tsc clean. PM-user confirmed via browser: clean honeycomb, hover works.
**Status:** ✅ shipped.
