# Chauss — Opening Trainer

A browser app for learning chess openings from the side you play: which moves are theory, which opponent moves are bad, and how to punish them. Two openings so far, chosen in a picker on your first visit and switched from the button in the header:

- the **Ponziani Opening as White** (1.e4 e5 2.Nf3 Nc6 3.c3);
- the **Caro-Kann Defence as Black** (1.e4 c6).

Progress is kept separately for each opening.

**Status:** all three modes work — **Explore** (look up any position), **Drill** (learn your moves with spaced repetition) and **Play** (a game against a bot that plays like people at your level, or one that makes the common mistakes on purpose). A GitHub Pages workflow is ready; the site is not published yet.

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
| `npm run snapshot` | Rebuilds the Ponziani data from Lichess (slow; needs a token — see below). Add `-- --opening=caro-kann` for another opening |
| `npm run traps` | Rebuilds an opening's list of common mistakes from its data (no network); also takes `-- --opening=<id>` |

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

At ten key positions a short **idea** explains what matters there (for example which move masters play, and which popular mistakes to punish). Each idea is checked against the bundled data by a test: every number and claim in it must match the data, or the idea is not shown.

Nothing here is written from memory: the names and numbers come from the Lichess opening explorer, the marks and lines from Stockfish.

### Bundled data and live data

The app ships with a snapshot of each opening's tree, so it works offline and without an account: `src/data/openings/ponziani.json` (826 positions, built 13 November 2026) and `src/data/openings/caro-kann.json` (400 positions, built 15 November 2026), both from Lichess games rated 1000–1399 and master games, every move scored by Stockfish. The Ponziani tree stops where a move is played in fewer than 3% of games or too few games, and where a move leaves the Ponziani for another opening; the Caro-Kann tree is cut at 400 positions, the most played ones first. Each opening also has a list of common mistakes (`<id>.traps.json`) and a few written key ideas, every number in them checked against the data by a test.

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

crawls (add `--opening=caro-kann` to either command for the Caro-Kann; the openings and their settings are listed in `src/openings/registry.ts`), scores every position with Stockfish and writes the file. It is slow on purpose (one request every 3.5 seconds) and can be stopped and restarted: answers are kept in `.cache/`. The settings used are recorded inside the file.

## Drill

The app plays the other colour and you play yours (White in the Ponziani, Black in the Caro-Kann, where the app plays 1.e4 and you must find 1...c6). In every position you must find **your repertoire move**: the move masters play most there, unless Stockfish rates another move clearly better (more than 5 points of winning chances). The opponent's replies are chosen the way players at your level choose them, weighted by how often they are played.

- A wrong move is taken back. You see the right move (an arrow) and why it is the one; play it to go on.
- Each position is a card with its own review date (spaced repetition, SM-2). Positions you miss come back soon; ones you know well come back later. The next line aims at a card that is due, then at a new one.
- **Statistics** lists every position with its tries, misses and next review. Your progress is stored in this browser only: **Save a backup file** keeps it safe, **Load a backup file** brings it back (also on another computer).

The evaluation and the arrows are switched off in a drill, so you think for yourself.

## Play

A game against a bot that plays the other colour, starting from move 1. Choose the bot:

- **Realistic** — plays the moves people at your level play, each as often as they play it.
- **Punish me** — prefers the moves Stockfish calls mistakes (among those people really play), then moves that head for a known common mistake. Use it to practise punishing them.

The eval bar and arrows start hidden here too; switch them on with `E` and `A` if you want them.

## Leaving the opening data

When a drill line or a game reaches a position the opening data does not cover, the app asks what to do, every time:

- **Stop: show Stockfish's verdict** — who stands better and by how much, the best move, Stockfish's main line, the verdict on the last move and, where one is written, the key idea of the line.
- **Play on against Stockfish** — a weakened Stockfish takes over the opponent's side. Pick how strong: Easy (Skill Level 0, looks 4 half-moves ahead), Medium (Skill Level 5, depth 8) or Hard (Skill Level 10, depth 12).

## The engine

Stockfish runs in your browser, in the background. After each move it compares the winning chances before and after the move:

| Mark | Meaning | Winning chances dropped by |
| --- | --- | --- |
| `?!` | Inaccuracy | 10 points or more |
| `?` | Mistake | 20 points or more |
| `??` | Blunder | 30 points or more |

Winning chances come from the engine's score using the same formula as Lichess. The eval bar shows White's winning chances as the light part; `+0.5` means White is half a pawn better, `#3` means White can force checkmate in 3.

## Analyse a game

The **Analyse** tab reviews a whole game. Paste a PGN (from Lichess, chess.com, or just `1.e4 e5 2.Nf3 …`), or press **Analyse this game** in the Play tab. Stockfish looks at every position — set how long in **Settings → Game analysis** (depth 10–18, or 0.5–3 seconds per move; default depth 14) — and you can cancel at any time. It runs in its own background worker, so the page stays usable.

Each move gets a label:

| Icon | Label | When |
| --- | --- | --- |
| `≡` | Book | a move masters play here (from the bundled opening data), while the game is still in the book |
| `□` | Only move | the only legal move |
| `!!` | Brilliant | a best move that leaves a piece to be taken — a real sacrifice |
| `!` | Great | the only good move: the second-best move was at least 10 points of winning chances worse |
| `★` | Best | Stockfish's first choice, or within 1 point of it |
| `✓` | Excellent / Good | lost less than 4.5 / 10 points |
| `?!` `?` `??` | Inaccuracy / Mistake / Blunder | lost 10 / 20 / 30 points or more (as everywhere in the app) |
| `×` | Miss | the opponent had just made a mistake, and this move gave the chance straight back |

Accuracy per move is `103.16 · e^(−4 · loss) − 3.17` (loss = winning chances lost, as a fraction); a player's accuracy is the average over their moves. The graph shows White's winning chances over the game, with dots on the notable moves; click it, a move, or use the arrow keys to step through the game.

## Credits

The move labels (the order of checks, the mate rules, the "great" and "brilliant" tests with their piece-safety rules) and the accuracy formula are adapted from [WintrChess](https://github.com/WintrCat/wintrchess) by WintrCat, licensed GPL-3.0. The thresholds for inaccuracies, mistakes and blunders, and the "miss" rule, are Chauss's own.

## Publishing on GitHub Pages

`.github/workflows/deploy.yml` builds the site, runs the unit and browser tests, and publishes it at <https://1chillehotdogpro.github.io/Chauss/> on every push to `main`.

One-time setup: on GitHub, open the repository's **Settings → Pages** and set **Source** to **GitHub Actions**. Then push `main`. The run shows up under the **Actions** tab; when it is green, the site is live.

## Licence

GPL-3.0-or-later — see `LICENSE`. The board is [chessground](https://github.com/lichess-org/chessground) (GPL-3.0-or-later), the rules come from [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause), and the engine is [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0; see `public/engine/README.md`). Opening statistics and opening names come from the [Lichess opening explorer](https://lichess.org/api#tag/opening-explorer).
