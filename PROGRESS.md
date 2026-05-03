# Heroes Clone — Progress Log

Stack: TypeScript + Phaser 3 + Vite. PM/orchestrator: Claude Code (this terminal). Coder + QA: separate `claude` CLI sessions in their own Terminal windows.

---

## C0 — Cleanup: downgrade Phaser 4 → 3
**Coder:** package.json now `phaser: "^3.80.0"`, installed `phaser@3.90.0`. No `src/` edits needed (existing code already valid Phaser 3). `npm run build` ok (chunk warning only). Dev server served HTML.
**QA:** FAIL on methodology (correct call). Code-level checks all PASS. Failed because (1) no git baseline → diff scope unverifiable; (2) `PROGRESS.md` added by PM outside coder's file allow-list with no audit trail.
**PM action:** create baseline commit covering S1+C0+PROGRESS.md so future slices have a clean diff origin. Future slices: coder/QA must respect the committed baseline.
**Status:** ✅ code GREEN, audit gap closed by baseline commit `4eae361`.

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
