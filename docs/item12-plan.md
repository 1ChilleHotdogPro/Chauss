# Item 12: choose which opening to learn

## How to use this file
Run one step per session. Start each session with the prompt shown under the step. After the step: build + unit tests pass, commit locally (no push), stop.
Rules for every step: never read the big snapshot JSON files in full (use grep/jq); run only `npm run build` and `npm test` unless the step says otherwise; screenshots only in step 7; run long crawls with run_in_background and don't poll them.

## Context
Today the app only teaches the Ponziani as White. The opening is hard-coded in the crawler (ROOT_LINE, output path), the data files (src/data/ponziani.json, traps.json), the ideas list (src/explore/ideaList.ts), the repertoire and drill (whiteWin, blackReplies), the bot (pickBlackMove), the board ('white-only') and the UI text ("Your move as White").

Goal: an opening registry, a picker on first load (remembered, switchable from the header), and a second opening, Caro-Kann as Black, so playing as Black is built and tested now.

Decisions: Black is in scope now; first new opening is the Caro-Kann (1.e4 c6); the switch control is a header button. No new dependencies.

## Design

### 1. Registry and file layout
- `src/openings/registry.ts` (pure data, importable by Node scripts and the app): `OpeningDef { id, name, side: 'white'|'black', rootLine: string[], family: string, crawl: { minShare, minGames, minGamesMasters, maxPly, maxPositions, depth } }`. Entries: `ponziani` (white, e4 e5 Nf3 Nc6 c3, the thresholds recorded in today's ponziani.json meta) and `caro-kann` (black, e4 c6, same thresholds to start; family taken from the explorer's name for the position, checked in the survey run, not typed from memory).
- `src/openings/assets.ts` (browser only): per id, `new URL('../data/openings/<id>.json', import.meta.url)` and the traps URL, plus `ideas: () => import('../explore/ideas/<id>')`. Literal paths per entry so Vite emits each file as its own asset/chunk; only the chosen opening is fetched.
- Files: `git mv` to `src/data/openings/ponziani.json`, `ponziani.traps.json`; ideas to `src/explore/ideas/ponziani.ts`. New: `caro-kann.json`, `caro-kann.traps.json`, `src/explore/ideas/caro-kann.ts`.
- `src/snapshot/load.ts` / `src/explore/loadTraps.ts` take an opening id and cache per id. `SnapshotMeta` gains optional `openingId` and `side` (missing = Ponziani/white), so the existing file stays valid with formatVersion 1 and needs no rebuild.

### 2. Crawler and traps script
- `build-snapshot.ts`: `--opening=<id>` (reads root line, family, side and thresholds from the registry; other flags still override) or ad hoc `--root="e4 c6" --side=black --out=<path>`. Output defaults to `src/data/openings/<id>.json`; `--survey` reports the opening position generically.
- `crawl.ts`: a sideline is where the opponent leaves the root line (today hard-wired to Black); recommended is the reply for the user's side (`recommendReply` is already side-neutral). For the Caro-Kann that means White's other first moves get one recommended Black reply.
- `build-traps.ts`: `--opening=<id>`; reads/writes that opening's files. Trap kind: exploit = the opponent errs, avoid = the user's side errs; traps meta records side, and `validateTrapFile` checks against it.
- Explorer limits unchanged (token from LICHESS_TOKEN/.env.local, ~3.5 s between requests, >=60 s wait on 429, shared .cache/). The Caro-Kann crawl (~1 h) and traps build (~40 min) run with run_in_background while the next steps are coded.

### 3. Playing as Black
- Repertoire: `buildRepertoire(snapshot, side)`, `chooseMove(node, side)` uses `winPercent(..., side)`; `blackReplies` -> `opponentReplies`; cards on `sideToMove === side`; `cardLabel` already works from ply parity.
- Drill: `DrillSession` plays the opponent until the user's card (no 'b' check); with the Caro-Kann the app plays 1.e4, the user must find 1...c6.
- Bot: `pickBlackMove` -> `pickOpponentMove(position, side)`; `trapRoutes` uses exploit traps; `treeStatus`, engine play-on and the `continueGame` turn checks use the opponent colour.
- Board: orientation = the opening's side on load and on mode change (Flip still works); 'white-only' -> 'player-only' with a colour.
- Icons/verdicts are already from the mover's point of view (`judgeMove`, `buildRanking`, `buildExplorePosition`); nothing changes there beyond a test with a Black-to-move position. Eval bar stays White's share and follows orientation.
- Text: "Your move as White/Black", "White/Black played ...", "Mistakes to avoid as Black", the empty-move hint, all from the side.

### 4. Progress migration
- Progress v2 at `chauss.progress.v2`: `{ version: 2, openings: { [id]: { cards } } }`. On load: if v2 is missing and `chauss.progress.v1` exists, map its cards to `openings.ponziani`, write v2, leave v1 untouched (safe rollback).
- Export writes v2. Import accepts v2 and v1 files (v1 -> ponziani). Reset clears only the current opening (confirm text says which).
- New key `chauss.opening.v1` = chosen id. Play/explorer/section settings and the explorer cache stay global.

### 5. Picker UI
- `<dialog id="opening-picker">` (`src/ui/openingPicker.ts`): one card per registry entry (name, "You play White/Black", root moves). Shown with `showModal()` on load when no id is stored or the stored id is unknown; data loading waits for the choice.
- Header: the opening name becomes a button ("Ponziani · White ▾") that opens the picker. Switching stores the id and reloads the page (all state is rebuilt from the chosen data; simplest and safest given main.ts is one module-level script).
- Board hotkeys are blocked while the picker is open (add it to the dialog check in main.ts). Page `<title>` and header text become generic ("Chauss — opening trainer").

### 6. Traps, ideas and refutations per opening
- Traps and refutations come from `build-traps.ts` (engine depth 22 + explorer popularity), per opening.
- Caro-Kann ideas: candidate positions picked from the snapshot (high-reach positions and the popular mistakes in the traps file). Each idea's line, eval and refutation are taken from the data/Stockfish output; the 1-2 sentence text only states what that output shows. `ideas.test.ts`-style checks run for every opening: each line exists in its snapshot, the evals match, the band matches `meta.lichess.ratings`.

### 7. Docs
CLAUDE.md "Opening scope" -> multi-opening: registry, per-opening files, crawler args, side rules, sideline = opponent deviation. Also index.html, package.json description, README.md.

## Steps (one local commit each; no push)

### Step 1: Registry, moved files, loaders (no behaviour change)
Registry + move Ponziani files + per-id loaders + dynamic ideas import. Update tests tied to old paths (phase4 asset regex).
> Do step 1 of docs/item12-plan.md (sections 1 and the file moves). No behaviour change. Run build + unit tests, commit locally, stop.

### Step 2: Crawler/traps args, opponent-side sidelines, trap kinds by side
Then start the Caro-Kann survey + crawl in the background (do not poll).
> Do step 2 of docs/item12-plan.md. When the code works and tests pass, commit, then start the Caro-Kann survey and crawl with run_in_background and stop. Don't poll it.

### Step 3: Side-aware repertoire, drill, bot, board, text
Unit tests with a small Black fixture. Update phase5/phase6 "white-only" and "Your move as White" tests. Run e2e once at the end of this step.
> Do step 3 of docs/item12-plan.md (section 3). Unit tests with a small Black fixture. Build + unit tests + one e2e run at the end, commit, stop.

### Step 4: Progress v2 + migration + export/import
> Do step 4 of docs/item12-plan.md (section 4). Build + unit tests, commit, stop.

### Step 5: Picker dialog + header button
e2e helper `openApp` seeds `chauss.opening.v1` (default ponziani) so existing specs keep working. New `e2e/openings.spec.ts`: picker on first load; choose Caro-Kann -> board shows Black at the bottom, drill plays 1.e4 and accepts 1...c6, wrong move shows the correct one; bot plays White; switch back via the header; seeded v1 progress still shows its stats under Ponziani; export -> import round trip; no console errors.
> Do step 5 of docs/item12-plan.md (section 5 plus the e2e spec described). Build + unit tests + e2e, commit, stop.

### Step 6: Caro-Kann data, traps, ideas
Commit the Caro-Kann snapshot (check the crawl finished), run the traps build in the background (do not poll), then write data-backed ideas from the output.
> Do step 6 of docs/item12-plan.md. Check the crawl output exists, commit it, start the traps build in the background, stop. In a later session, write the ideas from the traps output (section 6).

### Step 7: Docs, screenshots, review
Docs (section 7). Screenshots at desktop and 390 px (picker, header button, Black drill, traps dialog) into test-results/. Then /code-review at low or medium effort on the final diff; /simplify optional.
> Do step 7 of docs/item12-plan.md.

## Verification (end of steps 3, 5, 6, 7; build + unit tests every step)
`npm run build`, `npm test`, `npm run test:e2e` all pass.
