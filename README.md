# Chauss — Ponziani Opening Trainer

A browser app for learning the **Ponziani Opening as White** (1.e4 e5 2.Nf3 Nc6 3.c3): which moves are theory, which opponent moves are bad, and how to punish them.

**Status:** Phase 4 — Explore mode. Click through the opening and see, at every position, the book moves (master games) and the moves popular at your level (Lichess), with mistakes flagged and Stockfish's refutation for each. Drill and play-against-a-bot modes come in later phases (see `CLAUDE.md`).

## Run it locally

You need [Node.js](https://nodejs.org/) (LTS or newer).

```bash
npm install
npm run dev
```

Then open the address Vite prints (it ends in `/Chauss/`).

## Other commands

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm test` | Unit tests for the chess and engine logic (Vitest), including a run of the real engine file |
| `npm run test:e2e` | Browser tests against the built site (Playwright; first run `npx playwright install chromium`) |
| `npm run snapshot` | Rebuilds the bundled opening data from Lichess (slow; needs a token — see below) |
| `npm run traps` | Rebuilds the list of common mistakes from the bundled data (no network) |

On Windows PowerShell, if `npm` is blocked by the script policy, use `npm.cmd` instead (for example `npm.cmd run dev`).

## Controls

- Click or drag a piece to move it. Only legal moves are accepted.
- **Flip board** (or press `F`), **Undo**, **New game**.
- `←` / `→`, or click a move in the list, to step through the game.
- **Show eval** (or press `E`): the eval bar and the engine's three best lines.
- **Show arrows** (or press `A`): arrows for the engine's three best moves (green = best).

## The opening explorer

Under **Opening explorer** you see two separate lists for the position on the board:

- **Book** — moves from master games.
- **Popular at your level** — moves from Lichess games in your rating group (default 1000–1399; change it in **Settings**).

Each row shows how often the move is played, how many games, and the results (White wins / draws / Black wins). Click a move to play it.

A coloured mark (`?!`, `?`, `??`) means Stockfish thinks the move gives something away. Click the mark to see **why**: the best reply, the line, the score, and one sentence built from that line (for example "White wins a knight"). **Rank every legal move** asks Stockfish to score all moves in the position, worst first. **Common mistakes in this opening** lists the losing moves that are played most often — for your opponents to make, and for you to avoid.

Nothing here is written from memory: the names and numbers come from the Lichess opening explorer, the marks and lines from Stockfish.

### Bundled data and live data

The app ships with a snapshot of the Ponziani tree (`src/data/ponziani.json`), so it works offline and without an account. It stops where a move is played in fewer than 3% of games or too few games, and where a move leaves the Ponziani for another opening.

For positions outside the snapshot, or for other rating groups, the app can ask Lichess directly. That needs a personal token:

1. Create one at <https://lichess.org/account/oauth/token> (no boxes ticked).
2. Paste it under **Settings → Lichess token**. It is stored in your browser only and sent only to Lichess.

Lichess allows about twenty explorer requests a minute, so live data appears after a short pause.

### Rebuilding the snapshot

Put the token in a file named `.env.local` in the project folder (`LICHESS_TOKEN=...`; Git ignores this file), then:

```bash
npm run snapshot -- --survey
```

shows how big the tree would be for different settings, and

```bash
npm run snapshot
```

crawls, scores every position with Stockfish and writes the file. It is slow on purpose (one request every 3.5 seconds) and can be stopped and restarted: answers are kept in `.cache/`. The settings used are recorded inside the file.

## The engine

Stockfish runs in your browser, in the background. After each move it compares the winning chances before and after the move:

| Mark | Meaning | Winning chances dropped by |
| --- | --- | --- |
| `?!` | Inaccuracy | 10 points or more |
| `?` | Mistake | 20 points or more |
| `??` | Blunder | 30 points or more |

Winning chances come from the engine's score using the same formula as Lichess. The eval bar shows White's winning chances as the light part; `+0.5` means White is half a pawn better, `#3` means White can force checkmate in 3.

## Licence

GPL-3.0-or-later — see `LICENSE`. The board is [chessground](https://github.com/lichess-org/chessground) (GPL-3.0-or-later), the rules come from [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause), and the engine is [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0; see `public/engine/README.md`). Opening statistics and opening names come from the [Lichess opening explorer](https://lichess.org/api#tag/opening-explorer).
