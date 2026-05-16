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

## S28.0 — Daily streak counter
**PM (direct):** On full-clear, if the run was a `daily:DATE` seeded game, update `localStorage["heroes-clone:dailyStreak"]`:
- If yesterday's date won previously → increment streak
- If older → reset to 1
- If already won today → no change
About modal now shows "Daily streak: N day(s) 🔥" when active. Encourages playing daily.
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S27.2 — Difficulty label on map UI
**PM (direct):** New small uppercase difficulty label (`EASY` / `NORMAL` / `HARD`) under the turn counter top-left, color-coded green/gold/red. Player always knows what scaling is active.
**Hiccup:** initial edit redeclared `const difficulty` clashing with an existing identifier in the enemy render block — Vite oxc parser rejected the file (every test failed because canvas never mounted). Fixed by renaming the second one to `diffMode`. Caught via dev-server 500 response in curl.
**Verification:** all 60 tests pass after fix.
**Status:** ✅ shipped (PM direct).

---

## S27.1 — Random Game uses seeded RNG (shareable)
**PM (direct):** Random Game button now picks a random 32-bit integer seed and routes through `startSeededGame`. Result: every Random Game shows a `seed:N` label and is shareable via the existing Share button (S25.3). Removed duplicate inline generation code from the Random Game handler.
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S27.0 — Game-won shows turn count + best-clear tracking (speedrun)
**PM (direct):** Win overlay now displays `"All enemies defeated in N turns"`. Compares to `localStorage["heroes-clone:bestTurns"]`; if better, shows `"NEW BEST!"` and writes it. Otherwise shows `"best: M"`. About modal in TitleScene also surfaces the best-clear time alongside Hall of Fame best level.
**Effect:** Adds a speedrun layer — players motivated to clear faster on subsequent runs.
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S26.2 — Turn counter persisted to localStorage
**PM (direct):** Added `turnCount?: number` to `SaveData`. `saveProgress()` writes the registry value; `loadProgress()` restores it on next page load. Turn counter now survives full browser refresh, matching all other game state.
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S26.1 — Turn counter on map UI
**PM (direct):** New `turnLabel` Text at top-left (20, 20). `registry["turnCount"]` lazy-init to 1; increments each `endTurn()` call. Persists across scene transitions (already in registry). Reset/New Game clears via existing flows. Displays "Turn N" in neutral gray for quick at-a-glance pacing reference.
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S26.0 — Speed `MAX` mode in combat
**PM (direct):** Cycle is now `1× → 2× → 4× → MAX → 1×` where MAX = 100× (all durations clamp to 1ms). Combined with AUTO this effectively auto-resolves combat with no animation. Existing s17-1 cycle test updated to expect the new 4-step cycle (added assertion for `Speed: MAX` label).
**Verification:** all 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S25.3 — Share button on seeded maps (closes v1.12)
**PM (direct):** On any seeded run (Daily or `?seed=N`), a small blue "Share" button appears below the seed label top-right. Clicking copies the canonical `${origin}/?seed=N` URL to the clipboard via `navigator.clipboard.writeText`. For `daily:` labels, the seed is reverse-derived from the FNV-1a hash of `"heroes-clone:DATE"`. Shows a brief toast top-center confirming the copy (or falls back to displaying the URL if clipboard API is denied).
**Verification:** all 60 tests pass.
**Status:** ✅ shipped — closes v1.12 (seed sharing complete).

---

## S25.2 — Seed sharing via URL (?seed=N)
**PM (direct):** Refactored Daily Challenge → general `startSeededGame(seed, label)` helper. TitleScene's URL handler now parses `?seed=N` and starts a seeded run with label `"seed:N"`. Daily uses `seed:fromString("heroes-clone:YYYY-MM-DD")` and label `"daily:YYYY-MM-DD"`. The seed label renders top-right on map (italic small text below enemy counter), only on seeded runs. Enables Wordle-style shareable map URLs.
**Verification:** new e2e `s25-2-seed-url.spec.ts` — (a) same seed → identical terrain across reloads, (b) different seeds → different terrain. All 60 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S25.1 — Seeded RNG + Daily Challenge (v1.11)
**PM (direct):** New `src/rng.ts` — `mulberry32(seed)` PRNG + `seedFromString(s)` FNV-1a hash + `todayDateString()` returns YYYY-MM-DD. Threaded an optional `rng?` parameter through all four `MapScene.generateRandom*` statics (terrain, enemySpawns, pickups, towns). New TitleScene button "Daily" seeds with today's date and starts a reproducible map — same player will get same map on the same day; same date = same map for every player.
**Verification:** new e2e `s25-1-daily-seed.spec.ts` clicks Daily twice (same day) and asserts both `randomTerrain` and `randomEnemySpawns` are byte-identical. All 58 tests pass.
**Status:** ✅ shipped — closes v1.11 (seeded RNG infrastructure + first use).

---

## S25.0 — Hall of Fame in About modal
**PM (direct):** On full-clear (GAME WON), record the hero's level to `localStorage["heroes-clone:bestLevel"]` (only if it beats the previous best). About modal in TitleScene shows "Hall of Fame — Best level on full clear: N" plus the existing total-kills counter. If no full clear yet, shows "No full clears yet — defeat all 6 enemies!". Persists across runs and resets.
**Status:** ✅ shipped (PM direct). All 57 tests pass.

---

## S24.3 — Help overlay mentions M key (closes v1.10)
**PM (direct):** Added a `GLOBAL` section to the help overlay text listing `M — toggle sound on/off` alongside the existing H/?. Tag v1.10.0 bundles S24.1+S24.2+S24.3.

---

## S24.2 — Mute toggle (M key)
**PM (direct):** Added `toggleAudio()` / `isAudioEnabled()` / `setAudioEnabled()` to `audio.ts`. Mute state persists to `localStorage["heroes-clone:muted"]` (independent of save). M key on MapScene shows a brief "Sound ON" / "Sound OFF" toast top-center (1s hold + 400ms fade). M key on CombatScene toggles silently (combat already has visual feedback). State loaded on first audio call.
**Verification:** all 57 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S24.1 — Web Audio sound effects (no external assets)
**PM (direct):** New `src/audio.ts` synthesizes tones via Web Audio API — no external sound files. Lazy AudioContext (browser autoplay policy requires user gesture). 5 SFX:
- `sfxAttackHit` — 220Hz square 80ms (hero hits enemy)
- `sfxEnemyHit` — 160Hz sawtooth 80ms (enemy hits hero)
- `sfxPickup` — 880Hz sine 120ms (potion/scroll grab)
- `sfxVictory` — 523/659/784Hz triangle arpeggio (C-E-G ascending)
- `sfxDefeat` — 220→165Hz sawtooth descending
Wired into CombatScene (attack/enemy attack peaks + outcome) and MapScene (potion/scroll consume). All calls wrapped try/catch — tests run silently since no audio assertion is meaningful.
**Verification:** all 57 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S23.2 — Enemy loot drops (closes v1.9)
**PM (direct):** Every combat victory has a 30% chance to drop loot (50/50 between +5 HP heal and +3 XP). Applied in MapScene's isSceneTransition block after `applyXpGain`. The drop result is appended to `lastOutcome` so the on-map banner shows "VICTORY: defeated Goblin (+2 XP) — Loot: +5 HP". Loot rate configurable via `registry["lootChance"]` (default 0.3); tests asserting exact post-victory HP/XP set it to 0 (s10-0, s9-1, s6-1, s6-3, s11-0, s11-1, s7-1 all patched).
**Verification:** all 57 tests pass.
**Status:** ✅ shipped — closes v1.9 (smart AI + confirm + loot).

---

## S23.1 — Reset confirm dialog (prevent accidental save wipes)
**PM (direct):** Reset button click now opens a confirm overlay (dark scrim + panel + "Yes, reset" / "Cancel" buttons). Yes wipes save and restarts; Cancel dismisses without changes. Refactored direct wipe code into new `confirmReset()` method.
**Test updates:** 4 tests that click Reset directly (s7-1, s9-1, s11-0, s11-1) now also click the "Yes, reset" button at (540, 410) immediately after.
**Verification:** all 57 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S23.0 — Smart enemy targeting on Hard difficulty
**PM (direct):** Refactored `doEnemyAttackPeak` to use `chooseEnemyTarget()` helper instead of hardcoded `activeStackIndex`. On Easy/Normal: enemy attacks the active hero stack (existing behavior, all tests still pass). On Hard: focus-fires the alive hero stack with lowest `currentHp`. Routed-stack auto-switch only fires when the active stack dies (not when a non-active targeted stack dies). Defeat detection now checks "all stacks dead" rather than "active stack dead with no fallback". New `spawnDeathPuffForStack` variant takes explicit stack index for proper visual feedback when the targeted-not-active stack loses units.
**Initial attempt** broke 7 tests by changing target unconditionally — refined to gate on difficulty.
**Verification:** new e2e `s23-0-hard-targeting.spec.ts` sets `registry.difficulty="hard"`, fights Goblin with Swordsmen active, confirms Archers (lower HP) get hit not Swordsmen. All 57 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S22.1 — Persistent total-kills counter shown in About
**PM (direct):** Each victorious return to MapScene increments `registry["totalKills"]` and writes `localStorage["heroes-clone:totalKills"]`. TitleScene's About modal reads the localStorage key and displays "Total enemies defeated across all sessions: N". Survives full game reset (separate localStorage key from main save).
**Status:** ✅ shipped (PM direct). All 56 tests pass.

---

## S22.0 — Combat-state save/restore across page reload (closes v1.8)
**PM (direct):** New `inCombat` field in `SaveData` capturing the full combat state (enemy id+coords+stats, hero army, round number). `persistCombatState()` called after each enemy retaliation lungeComplete writes it to localStorage. Victory/Defeat/Return/ESC clear it via `clearCombatSave()`. TitleScene (on plain `/` only) checks for `inCombat` and if present, auto-resumes via `scene.start("CombatScene", inCombat)`. CombatScene's `init` accepts `roundNumber` to restore counter. Tests still use `?nointro` which bypasses TitleScene entirely.
**Verification:** new e2e `s22-0-combat-resume.spec.ts` — fights Goblin one round, verifies inCombat in localStorage, reloads to plain `/`, confirms CombatScene resumes with enemyHp=2 (mid-fight). All 56 tests pass (2.6m).
**Status:** ✅ shipped — closes v1.8 (combat persistence + cleanup).

---

## S21.1 — Remove unused BootScene (cleanup)
**PM (direct):** `BootScene.ts` was the original placeholder scene from S1; replaced by TitleScene as the start scene in S16.1 but the file was left in place. Removed `src/scenes/BootScene.ts` and dropped its import + scene-array entry in `src/main.ts`. All 55 tests pass — nothing referenced it functionally.
**Status:** ✅ shipped (PM direct).

---

## S21.0 — Title button on map
**PM (direct):** Small "Title" button (100×26 gray-stroked, neutral) below Reset at top-right. Click → `scene.start("TitleScene")` so player can return to title without losing save (registry + localStorage preserved). Disabled while animating. All 55 tests pass.
**Status:** ✅ shipped (PM direct).

---

## S20.2 — Difficulty selector in TitleScene (closes v1.7)
**PM (direct):** New `registry["difficulty"]` ("easy" / "normal" / "hard"), default normal. Enemy render loop reads it and scales `stackCount` by 0.6× / 1.0× / 1.6× — visibly fewer/more units per enemy. New TitleScene cycle button below About: shows current difficulty with color (green/gold/red), click to cycle. Persists across navigation since it's in registry. Tests skip TitleScene via `?nointro` so they get default `normal`.
**Status:** ✅ shipped — closes v1.7 (towns + difficulty). All 55 tests pass.

---

## S20.1 — Random town positions on Random Game
**PM (direct):** New `MapScene.generateRandomTowns(terrain?, enemySpawns?, pickups?)` static — generates `TOWNS.length` random town positions avoiding hero spawn, water, enemy spawns, and pickup positions. Stored in `registry["randomTowns"]`. Render loop and visit-check both check the random array first, fall back to fixed TOWNS. TitleScene "Random Game" generates and stores; "New Game" clears.
**Status:** ✅ shipped (PM direct). All 55 tests pass.

---

## S20.0 — Towns (full-heal hex)
**PM (direct):** Added `Town` type and `TOWNS = [{col:10, row:12}]`. Render: blue bold "T" 32px depth 5 at the town hex (never consumed). `visitTown(col,row)` triggered in `animatePath`'s post-step block: fully restores `currentHp = count*hpPerUnit` for every army stack, syncs registry, updates HP label, spawns "FULL HEAL" floating text, saves. No-op if already at full HP.
**Verification:** new e2e `s20-0-towns.spec.ts` damages both hero stacks, teleports hero adjacent to town, clicks the town hex, asserts heroHp === 28 (full) and each stack at max. All 55 tests pass (one flake on retry — re-run cleared it).
**Status:** ✅ shipped (PM direct).

---

## S19.2 — Random pickup positions on Random Game
**PM (direct):** Added `MapScene.generateRandomPickups(terrain?, enemySpawns?)` returning `{ potions, scrolls }` of length matching POTIONS.length / SCROLLS.length. Avoids hero spawn, water tiles, and enemy spawns. Stored in `registry["randomPotions"]` + `["randomScrolls"]`. Render loops + pickup-check in `animatePath` both check the random arrays first, fall back to fixed POTIONS/SCROLLS. TitleScene's "Random Game" generates terrain + enemy spawns + pickups; "New Game" clears all four random keys. All 54 tests still pass — Random Game now produces fully procedural maps; default New Game keeps the fixed layout.
**Status:** ✅ shipped (PM direct).

---

## S19.0 — Random enemy positions on Random Game
**PM (direct):** New `MapScene.generateRandomEnemySpawns(terrain?)` static — picks 6 spawn coords avoiding hero spawn (with 5×5 buffer for breathing room), pickups, water (if terrain provided). Falls back to default spawn on placement failure. Stored in `registry["randomEnemySpawns"]`. Enemy render loop reads override per index, builds an `Enemy` with random col/row but same stats, defeat key uses the random coord. TitleScene "Random Game" generates BOTH terrain + enemy spawns; "New Game" clears both.
**Verification:** all 54 tests pass. Random Game now produces meaningfully different layouts each click.
**Status:** ✅ shipped (PM direct).

---

## S18.2 — Random map generator + "Random Game" button (v1.5)
**PM (direct):** Added `MapScene.generateRandomTerrain()` static method — generates 6-10 water tiles + 8-13 forest tiles at random valid positions (avoids hero spawn, all enemy spawns, all pickup spots). Stored in `registry["randomTerrain"]`. `terrainAt(col, row)` checks the registry first, falls back to fixed `TERRAIN_OVERRIDES`. New TitleScene button "Random Game" (sky-blue) sets the registry entry then starts MapScene; "New Game" clears the entry to use the fixed map. Refactored TitleScene to share `clearAllProgress()` helper.
**Verification:** new e2e `s18-2-random-map.spec.ts` — clicks Random Game button, asserts registry has randomTerrain with >10 entries, hero spawn (0,0) and Goblin spawn (4,4) still grass; clicks New Game, asserts no randomTerrain. All 54 tests pass (2.6m).
**Status:** ✅ shipped — closes v1.5 (procedural replayability).

---

## S18.1 — Last-combat-outcome banner on map
**PM (direct):** CombatScene's victory/defeat path now passes `lastOutcome: "VICTORY: defeated Goblin (+2 XP)"` (or `"DEFEAT by Troll — hero respawned"`) back to MapScene via scene-data. MapScene `create()` reads it and renders a brief Text banner at top-center (y=30, 20px bold, green/red, black bg padding), holds 2s then alpha-tweens out over 600ms then destroys.
**Verification:** all 52 tests pass — banner is purely additive UI shown only after combat-return scene transitions, no test currently asserts on it.
**Status:** ✅ shipped (PM direct).

---

## S18.0 — Enemies-remaining counter on map UI
**PM (direct):** Added `Enemies: N/6` text label below hero stat panel at (1280-20, 250), pink-red `#cc8888` 14px. Live count = `ENEMIES.length - defeatedEnemies.size`. No new test (single Text addition, behavior visible in any subsequent screenshot). All 52 tests still pass.
**Status:** ✅ shipped (PM direct).

---

## S17.1 — Combat speed slider (closes v1.4)
**PM (direct):** Added `public combatSpeed = 1` field + Speed button at (620, 530) right of AUTO button. Click cycles `1× → 2× → 4× → 1×`. New `scaled(ms)` helper divides ms by current speed. Applied to all combat tween durations: lunge (100ms), shake (4×50ms), puff (400ms), damage text (600ms), retaliation delay (400ms), camera shake. The 1500ms outcome→return delay kept as-is so player can read VICTORY/DEFEAT.
**Verification:** new e2e `s17-1-combat-speed.spec.ts` clicks Speed button 3× and asserts `combatSpeed` cycles 1→2→4→1 with label updates. All 52 tests pass (2.5m).
**Status:** ✅ shipped (PM direct) — closes v1.4 (title + help + speed).

---

## S17.0 — In-game help overlay
**PM (direct):** Press `H` (or `?`) on the map to toggle a help overlay listing all controls (map clicks, End Turn, Reset, combat A/1/2/O/ESC). Implemented as a `Phaser.GameObjects.Container` at depth 150 with dark Rectangle background + title + body Text + dismiss hint. `helpOverlay?: Container` field tracks open state. Click overlay background to close, or press `H` again. Hooked via `this.input.keyboard?.on("keydown-H", ...)` and `keydown-FORWARD_SLASH`.
**Verification:** new e2e `s17-0-help-overlay.spec.ts` clicks canvas for focus then `keyboard.press('H')`, asserts `map.helpOverlay !== undefined`, presses again, asserts gone. All 51 tests pass (2.5m).
**Brief detour earlier:** tried `scale.FIT` config for responsive canvas — broke 10 tests that use `canvas.click({ position: {x,y} })` since CSS scaling shifts coords. Reverted (would need updating all 16 click-position tests).
**Status:** ✅ shipped (PM direct).

---

## S16.1 — Title scene
**PM (direct):** New `src/scenes/TitleScene.ts` set as the startup scene. Shows "HEROES CLONE" 72px gold + "v1.3 — turn-based hex strategy" subtitle. Buttons: "Continue" (only if save exists, gold), "New Game" (clears registry + localStorage, starts MapScene), "About" (overlay with description). Tests skip via `?nointro` query param: every existing `e2e/*.spec.ts` updated via sed from `goto('/')` to `goto('/?nointro')`. TitleScene `create()` checks `window.location.search.length > 1` and short-circuits to MapScene if any param present.
**Verification:** new e2e `s16-1-title-scene.spec.ts` covers (a) plain `/` shows TitleScene with title text, (b) `/?nointro` skips it, (c) clicking New Game button transitions to MapScene. All 50 tests pass (2.4m).
**Status:** ✅ shipped (PM direct).

---

## S16.0 — Camera shake on unit death
**PM (direct):** Added `this.cameras.main.shake(duration, intensity)` in `spawnDeathPuff`. Intensity and duration scale with kill count (1 dead = subtle 120ms × 0.005, 4 dead = forceful 280ms × 0.011). Pairs with existing puff + sprite shake for visceral kill feedback.
**No new test** — pure visual polish, no observable state change worth asserting beyond visual inspection. All 48 existing tests still pass.
**Status:** ✅ shipped (PM direct).

---

## S15.1 — Enemy stack badge on map + Playwright sequential
**PM (direct):** Each enemy on the map now has a small `"x3"` Text badge (12px white bold) at offset (+0.55r, +0.5r) from the circle. `LiveEnemy` type extended with `badge: Text`. Enemy AI tween in `runEnemyMultiStep` now also tweens the badge in parallel so the count follows the enemy as it moves.
**Bonus:** set Playwright `workers: 1` in config — the test suite was occasionally flaking under parallel workers (Phaser game state shared via `window.__game` and localStorage). Sequential execution costs ~30s but is reliable.
**Test stability fix:** `s12-1-damage-shake.spec.ts` — was racing the enemy retaliation lunge after S15.0's multi-circle layout shifted timing slightly. Updated to wait for `isCombatAnimating === false && |x - initX| < 1` rather than fixed `waitForTimeout(350)`.
**Verification:** all 48 tests pass (2.4m sequential).
**Status:** ✅ shipped (PM direct).

---

## S15.0 — Enemy multi-stack rendering (v1.3 kickoff)
**PM (direct):** Replaced single `enemySprite` field with `enemySprites: Arc[]`. CombatScene `create()` reads `initData.enemyStackCount` (already passed by MapScene since S13.0) and renders N circles centered around (960, 360) with adaptive radius (50/40/35 for N=1/2/3+) and 1.6× spacing. Back-compat getter `enemySprite` returns `enemySprites[0]` so existing code (lunge, shake, puffs, click coords) keeps working. On enemy damage, hides rightmost circles for dead units (`unitsRemaining` decreases → `setVisible(false)`).
**Visual result:** Goblin (stackCount=3) renders as 3 red circles in a row; Troll (4) as 4; Wolves (2) as 2; Orc/Archer single. Each unit visibly disappears as combat progresses.
**Verification:** new e2e `s15-0-enemy-stacks.spec.ts` confirms 3 enemy sprites for Goblin combat, then verifies rightmost hides after 1 unit kill. All 48 tests pass (1.1m).
**Status:** ✅ shipped (PM direct).

---

## S14.4 — Keyboard shortcuts in combat (closes v1.2)
**PM (direct):** `A` = Attack, `O` = toggle Auto, `1`/`2` = select Swordsmen/Archers, `ESC` = Return to Map. Bound via `this.input.keyboard?.on("keydown-X", handler)`. Quality-of-life — no need to mouse-click for common combat actions.
**Verification:** new e2e `s14-4-keyboard.spec.ts` — uses `page.keyboard.press('2')`, `'O'`, `'A'`, asserts state changes. All 47 tests pass (57.7s).
**Status:** ✅ shipped — closes v1.2 (combat polish bundle: puffs + log + round counter + fade + auto + keyboard).

---

## S14.3 — Auto-attack toggle
**PM (direct):** Added `public autoAttack` field + `autoBtn` Rectangle 100×40 at (470, 530) right of Attack. `toggleAuto()` flips the flag and recolors button green when on. After each `enemyAttack` lungeComplete, if `autoAttack && !combatOver`, schedules next `onAttack` via 200ms delayedCall. Button starts gray, lights green when active. Stops automatically on victory/defeat. Clicking button mid-combat starts immediate auto-loop.
**Verification:** new e2e `s14-3-auto-attack.spec.ts` — toggle AUTO on, wait for `combatOver && logLines.includes("VICTORY!")` (auto drives 4 rounds vs Troll). All 46 tests pass (57.1s).
**Status:** ✅ shipped (PM direct).

---

## S14.2 — Round counter + scene-in fade
**PM (direct):** Added `public roundNumber` field + `roundText` Text below VS, format `"Round N"`. Increments at end of each full hero+enemy exchange (in `enemyAttack` lunge `onLungeComplete`). Refactored `enemyAttack` to extract `doEnemyAttackPeak()` so the lungeAttack call has both `onPeak` and `onLungeComplete` callbacks. Added a 250ms black-overlay fade-out at scene start (depth 1000 Rectangle, alpha 1→0 tween, then destroyed).
**Verification:** new e2e `s14-2-round-counter.spec.ts` — pin damage 1/1, click Attack, wait for `roundNumber === 2`, assert label "Round 2". All 45 tests pass (55.2s).
**Status:** ✅ shipped (PM direct).

---

## S14.1 — Combat log panel
**PM (myself, direct edit):** CODER agent hit user's monthly Claude usage limit mid-task. PM implemented S14.1 directly in the main session.
- New fields `public logLines: string[]` and `private logText`. 1200×120 dark Rectangle at (640, 660), text overlay at (60, 605).
- `addLogLine(line)` pushes + caps at 6 visible lines.
- Trigger points: `"Combat begins!"` on create; `"${activeStack} attack ${enemy} for ${dmg} damage. (Killed N)"` on hero hit; `"${activeStack} killed ${enemy}!"` on victory; `"${enemy} attacks ${activeStack} for ${dmg} damage."` on enemy hit; `"${activeStack} routed!"` on stack death; `"VICTORY!"` / `"DEFEAT"` from showOutcome.
- VICTORY/DEFEAT text repositioned y=600→560 to clear the log panel's top edge.
**Verification:** new e2e `s14-1-combat-log.spec.ts` covers initial log, full Goblin defeat sequence, expects 4 ordered events. All 44 tests pass (52.9s).
**Status:** ✅ shipped despite quota wall — direct PM implementation worked.

---

## S14.0 — Unit-death puff animation
**Coder:** When a damage event drops a stack's unit count, spawn one puff per dead unit at the stack's position. Each puff: Arc r=8, color matches stack (gold variants for hero, red for enemy), alpha 0.8, depth 30. Tween: scale 1→2.5, alpha 0.8→0 over 400ms, ease Cubic.easeOut. Multiple deaths stagger 100ms apart with ±15px random offset. `unitsRemaining(oldHp,hpPerUnit) - unitsRemaining(newHp,hpPerUnit)` computes kill count.
**Verification:** new e2e `s14-0-death-puff.spec.ts` triggers Troll combat with hero dmg pinned to 4 (kills 2 units), counts Arc children before/peak/after. All 43 tests pass (50.6s).
**Status:** ✅ shipped.

---

## S13.1 — Hero army with TWO unit stacks (closes v1.1)
**Coder:** Hero is now an army of 2 stacks: **Swordsmen** (count 5, HP 4/unit, dmg 1-3, total HP 20) + **Archers** (count 4, HP 2/unit, dmg 2-4, total HP 8). Total hero HP = 28 (up from 10). Stored in `registry["heroArmy"]` as `HeroStackState[]`, persisted to `SaveData.heroArmy`. Legacy `registry.heroHp` kept as derived sum.
**CombatScene:** two hero circles side-by-side (240, 360) and (400, 360), radius 40, gold variants. Active stack (default Swordsmen) shows thick yellow stroke; click another circle to switch. `rollHeroDamage` reads active stack's dmg range. Lunge animation uses active sprite. Enemy retaliation damages active stack's `currentHp`. Auto-switch to next living stack on death; defeat when all stacks dead.
**Level-up:** each stack `count += 1` and `currentHp += hpPerUnit`.
**Tests:** 11 existing test files updated for new HP totals (20/8 stacks vs old single 10). New `s13-1-hero-army.spec.ts` covers initial army shape, active toggle, Archers-active damage, retaliation reduces Swordsmen count.
**Verification:** all 42 tests pass (50.8s). PM verified screenshot showing two distinct stacks with active outline.
**Status:** ✅ shipped — closes v1.1 (multi-stack combat foundation).

---

## S13.0 — Stack-of-units representation (v1.1 kickoff)
**Coder:** Removed `Enemy.hp` field, replaced with `stackCount` + `hpPerUnit` (totals preserved: Goblin 3×1, Orc 5×1, Troll 4×2, Wolf 2×2, Archer 3×1). `unitsRemaining(currentHp, hpPerUnit)` helper computes living units from `Math.ceil`. CombatScene displays `"Name  xN"` integrated into the existing stack name label (initial badge attempt at y=420 overlapped HP bar — fixed by inlining into name row at y=280).
**Verification:** new e2e `s13-0-stacks.spec.ts` confirms initial badges (Hero x10, Troll x4) and updates after damage. All 38 tests pass (42.9s).
**Status:** ✅ shipped — foundation for full multi-stack rewrite.

---

## S12.1 — Damage shake on hit (closes v0.8 → v1.0)
**Coder:** New `shakeOnHit(target)` method — 4-step tween chain (50ms each, total 200ms) jittering sprite x by ±6 then ±4 then back. Triggered in `onAttack`/`enemyAttack` `onPeak` callbacks alongside damage application. Guards on `combatOver` to skip during scene transitions. Runs parallel to lunge return tween (different sprites, no conflict).
**Verification:** new e2e `s12-1-damage-shake.spec.ts` uses `waitForFunction` polling for sprite displacement (initial fixed-timeout approach hit the zero-crossing at ~75ms). All 37 tests pass (41.6s).
**Status:** ✅ shipped — combat now kinetic with attacker lunge + defender shake.

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
