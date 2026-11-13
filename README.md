# Chauss — Ponziani Opening Trainer

A browser app for learning the **Ponziani Opening as White** (1.e4 e5 2.Nf3 Nc6 3.c3): which moves are theory, which opponent moves are bad, and how to punish them.

**Status:** Phase 1 — a board that only allows legal moves, with a move list and a flip button. The engine, opening data and training modes come in later phases (see `CLAUDE.md`).

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
| `npm test` | Unit tests for the chess logic (Vitest) |
| `npm run test:e2e` | Browser tests against the built site (Playwright; first run `npx playwright install chromium`) |

## Controls

- Click or drag a piece to move it. Only legal moves are accepted.
- **Flip board** (or press `F`), **Undo**, **New game**.
- `←` / `→`, or click a move in the list, to step through the game.

## Licence

GPL-3.0-or-later — see `LICENSE`. The board is [chessground](https://github.com/lichess-org/chessground) (GPL-3.0-or-later) and the rules come from [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
