# Chauss — Ponziani Opening Trainer

Browser app that teaches the **Ponziani Opening as White** (1.e4 e5 2.Nf3 Nc6 3.c3): which moves are theory, which opponent moves are bad, and how to punish them, with Stockfish available for evaluation.

## User
- Beginner (<1200). Explanations short, concrete, no jargon without a one-line gloss. UI in English.
- Windows PC. Git installed. Node.js LTS must be installed before local dev (check `node -v`; if missing, stop and tell the user).

## Stack (decided — don't change without asking)
- Vite + TypeScript (strict). No UI framework.
- Board: chessground (verify current npm package name, it may be `@lichess-org/chessground`). Rules/SAN/FEN: chess.js.
- Engine: Stockfish WASM in a Web Worker. **Use a single-threaded build** — GitHub Pages cannot send the COOP/COEP headers needed for SharedArrayBuffer. Serve the engine files from `public/` with the correct base path.
- Tests: Vitest for logic, Playwright for end-to-end checks of the UI.
- License: GPL-3.0 (Stockfish and chessground are GPL).

## Hosting
- Local: `npm run dev`.
- GitHub Pages via GitHub Actions (`actions/deploy-pages`) on push to `main`. Repo: `1ChilleHotdogPro/Chauss`, so Vite `base: '/Chauss/'`.

## Opening scope
- Root: 1.e4 e5 2.Nf3 Nc6 3.c3. Black deviations at moves 1–2 (Sicilian, French, Petrov, 2...d6, etc.): cover lightly — one recommended sensible White reply each, no deep tree.
- Ponziani tree depth: as deep as the data supports — stop when a move's frequency falls below a configurable threshold (start ~3% of games at that node and a minimum game count).
- Short "idea" text (1–2 sentences) on key positions only. **Every idea, trap and refutation must be verified with Stockfish and the explorer data — never written from memory.**

## Theory data (Lichess opening explorer)
Two move sources, always shown **separately**:
1. **Book** — masters database.
2. **Popular at your level** — Lichess database filtered by a rating band selectable in settings (default band near 1000–1400; allow multiple bands) and speeds.

Data access:
- **Bundled snapshot**: `scripts/build-snapshot.ts` crawls the Ponziani tree from the explorer, attaches Stockfish evals (fixed depth) to each move, and writes `src/data/ponziani.json`. Committed to the repo, so the app works offline with no token. Respect Lichess rate limits (sequential requests; on HTTP 429 wait ≥60 s). Record snapshot date and parameters in the file.
- **Live API**: for exploring beyond the snapshot or other rating bands. The user pastes a Lichess personal token in settings (stored in localStorage only, sent as `Authorization: Bearer`). **First check the current Lichess API docs to see whether the explorer requires auth**, and handle 401/429 errors properly. Cache responses.

## Bad / out-of-book opponent moves ("mix of all")
- **Popular mistakes**: moves often played in the selected rating band whose eval drop is at least a "mistake" (see thresholds).
- **Classic traps**: a curated, engine-verified list for the Ponziani and its sidelines (traps for White to exploit and traps White must avoid).
- **Any move**: an option to list every legal Black move at a position, ranked by how badly Stockfish punishes it.
- For each one, show the refutation: the best White reply, the line, the eval, and one sentence on why it works.

## Modes
1. **Explore**: click through moves; at each node show the opening name, book moves, popular moves (with frequency and W/D/L), flagged mistakes/traps, and Stockfish output.
2. **Drill**: the app plays Black (weighted by data), the user must play the repertoire move as White. Wrong move → show the correct move and the reason, and record it. Track stats per line.
3. **Play vs bot (out of book)**: two bot settings, chosen in the UI:
   - **Realistic** — samples Black moves weighted by Lichess frequency in the selected band.
   - **Punish-me** — deliberately prefers mistakes and traps, so the user practises punishing them.
- When a drill or bot game leaves the known tree: **prompt the user each time** — (a) stop and show the Stockfish verdict + key idea, or (b) play on against a weakened Stockfish (Skill Level / limited depth).

## Stockfish display
- Eval bar, **hidden by default**, toggled with a button and a hotkey (so the user thinks first).
- Best-move arrows (top 1–3, MultiPV), also toggleable.
- A verdict after each move, based on win-percentage drop (Lichess formula: `win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`): inaccuracy ≥10, mistake ≥20, blunder ≥30 percentage points. Mate scores handled separately.

## Progress (persisted in the browser)
- Stats per line (attempts, errors, last seen).
- Spaced repetition of weak lines (SM-2 or a simple FSRS variant). The drill picks lines that are due first.
- Storage via IndexedDB or localStorage, wrapped in try/catch, with a versioned schema and JSON export/import.

## Build phases (one at a time; plan mode first; verify before moving on)
1. Scaffold: Vite + TS, chessground board, chess.js legal moves, move list, flip board. GPL-3.0 LICENSE.
2. Stockfish worker + eval bar + arrows + verdicts.
3. Explorer client (live + token) and the snapshot script; generate `ponziani.json`.
4. Explore mode with book/popular split, mistakes, traps and refutations.
5. Drill mode + stats + spaced repetition.
6. Bot mode (both settings) + out-of-book prompt + play-on vs weakened Stockfish.
7. GitHub Pages deploy workflow; confirm the live site loads the engine and the snapshot.

## Working rules
- After each phase: `npm run build` and the tests pass, then check in a real browser with Playwright — no console errors, the engine responds, the board works. Report what was verified.
- Never fabricate opening theory, statistics or traps; get them from the explorer data and Stockfish.
- Small, focused commits with clear messages. Ask before adding dependencies beyond the stack above.
- Keep logic (tree, SRS, engine wrapper, explorer client) separate from UI and unit-tested.
