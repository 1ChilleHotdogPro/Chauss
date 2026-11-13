# Chauss — Ponziani Opening Trainer

A browser app for learning the **Ponziani Opening as White** (1.e4 e5 2.Nf3 Nc6 3.c3): which moves are theory, which opponent moves are bad, and how to punish them.

**Status:** Phase 2 — a board that only allows legal moves, plus the Stockfish engine: an eval bar and best-move arrows (both hidden until you ask for them) and a verdict after every move. Opening data and training modes come in later phases (see `CLAUDE.md`).

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

## Controls

- Click or drag a piece to move it. Only legal moves are accepted.
- **Flip board** (or press `F`), **Undo**, **New game**.
- `←` / `→`, or click a move in the list, to step through the game.
- **Show eval** (or press `E`): the eval bar and the engine's three best lines.
- **Show arrows** (or press `A`): arrows for the engine's three best moves (green = best).

## The engine

Stockfish runs in your browser, in the background. After each move it compares the winning chances before and after the move:

| Mark | Meaning | Winning chances dropped by |
| --- | --- | --- |
| `?!` | Inaccuracy | 10 points or more |
| `?` | Mistake | 20 points or more |
| `??` | Blunder | 30 points or more |

Winning chances come from the engine's score using the same formula as Lichess. The eval bar shows White's winning chances as the light part; `+0.5` means White is half a pawn better, `#3` means White can force checkmate in 3.

## Licence

GPL-3.0-or-later — see `LICENSE`. The board is [chessground](https://github.com/lichess-org/chessground) (GPL-3.0-or-later), the rules come from [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause), and the engine is [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0; see `public/engine/README.md`).
