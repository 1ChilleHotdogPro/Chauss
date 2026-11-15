# Chauss — design review and redesign plan for agents

## Context
You asked for a designer's verdict on the live site (https://1chillehotdogpro.github.io/Chauss/) and a plan that Sonnet/Opus agents can carry out. I toured every screen at desktop and phone width: opening picker, Explore (with eval and arrows on), Drill hub, Drill → Openings, Analyse and Settings. I also read `src/theme.css`, `src/style.css` (1,294 lines), `src/appearance.css` and `index.html`.

## The verdict

**Overall: 6/10. The mood is right and the palette is good, but the layout has no hierarchy. Everything gets the same weight, so the page reads like a settings form with a chessboard next to it.**

### What works (keep it)
- **Palette.** Walnut brown, parchment text and candle-gold headings in `theme.css` work well together and pass contrast. Everything is a token, which makes a redesign cheap.
- **Mood.** The candlelight glow, paper grain, small-caps headings and wooden board frame really do feel "cozy dark academia".
- **Phone layout.** The board fills the width and the panel stacks below it. That's sound.

### What doesn't (ranked by impact)
1. **The page has no frame.** The board is already sticky on desktop, but the whole page scrolls, so the header and the panel start drift away and the panel has no top. Only the panel should scroll, inside a fixed app frame.
2. **The side panel is one long list where everything looks equal.** Status, verdict, nav buttons, moves, engine, two explorer tables, two action buttons and a FEN string all have the same weight. There is no "look here first". It needs a clear order: what's happening now → your moves → what to study (explorer), with engine details and FEN set back.
3. **All buttons look the same.** Explore, Undo, Show eval, "Rank every legal move" and "Common mistakes" are all identical brown pills. There is no primary action, no icons and no difference between a toggle and an action.
4. **The board clashes with the theme.** It's the stock Lichess brown board with chessground's lime last-move highlight. The engine arrows are neon pink, green and cyan, and the eval bar is a plain white/grey stripe. That's the most-viewed part of the app and it isn't in the theme.
5. **The Drill hub and opening picker are bare.** Two plain text boxes in the top-left of an empty dark page. These are the "front door" screens and they look unfinished. They should be cards with a mini board, a side badge ("You play White") and progress ("8 lines due").
6. **The explorer tables are cramped.** The numbers in the W/D/L bars are about 8px and unreadable. Move cells look like heavy buttons. "Book" and "Popular at your level" look identical, even though CLAUDE.md says to keep them clearly separate.
7. **The move list looks heavy.** At desktop width it is already a paired grid (`1. e4 e5`), but each move is a big chip and the current move a wide green bar. Below 761px it is one column of chips.
8. **Settings starts with the scariest part.** The Lichess token comes first. A beginner opens Settings for board/pieces and rating level, but those are near the bottom of a long scroll.
9. **Small things.** The favicon is a pawn emoji. The header has no logo mark. "Ponziani · White ▾" next to the mode tabs looks like a fourth tab. Focus and hover states are only a gold border.

## Direction: "The Study"
Keep the palette and fonts and add structure:
- **Desk and book.** The board is the desk (fixed, framed, warm). The panel is an open book: a header strip ("Black to move", verdict), then sections with clear rank.
- **Three button tiers.** Primary = forest-green fill, used for the one main action per screen (Next line, Analyse). Secondary = brown outline. Ghost/icon = for nav (◀ ▶ ⟲ flip) and toggles, using inline SVG icons.
- **A board skin that fits the theme.** A new default "Walnut" board, last-move and selected-square highlights in translucent gold, move dots in ink, arrows in theme colours (gold for best, muted green and parchment for 2nd and 3rd), and an ivory/ink eval bar with the score in mono.
- **Type scale.** Display (logo/h1), section (small caps), body, and "data" (tabular figures, at least 12px) for tables and numbers.
- **Fonts.** Stay on system serifs (no downloads). Self-hosted webfonts (e.g. EB Garamond plus a text serif) would look better, but only add them if you approve. CLAUDE.md says to ask before adding anything outside the stack.

## How the agents should work

### Ground rules (put these in every agent brief)
- Change only visuals and markup. No changes to logic modules (`src/drill`, `src/explore`, `src/analysis`, `src/engine` and the like). UI modules in `src/ui/*.ts` may change their DOM and classes only.
- Keep every element `id` that `e2e/*.spec.ts` uses. If a selector has to change, update the spec in the same commit.
- Colours, spacing and radii only through tokens in `src/theme.css`. Don't touch the cursed board/pieces rules in `src/appearance.css` (they must keep overriding everything).
- No new npm dependencies. Icons are inline SVG.
- Each agent owns only the files listed for it, so parallel agents never edit the same file.
- Done means: `npm run build`, `npm test` and `npm run test:e2e` pass, plus a screenshot check (see Wave 0) at 1280×800 and 390×844 with no console errors. Report with before/after screenshots.
- Git: use GitHub Desktop's git by full path and commit with `-F <file>` (see memory `git-via-github-desktop`). Make small commits. Never push.

### Wave 0 — Foundation (1 agent, **Opus**, runs alone)
Everything else builds on this, so it goes first and must not change how anything looks.
1. Split `src/style.css` into `src/styles/` files, one per area: `base.css`, `layout.css`, `header.css`, `buttons.css`, `board.css` (board, eval bar, captured pieces, coords), `panel.css`, `moves.css`, `explorer.css` (tables, flags, refutation, ranking), `dialogs.css` (settings, picker, traps, stats), `drill.css` (drill, endgame, hub, oob), `analysis.css`. Import them from `src/main.ts` where `style.css` was. **Done in Wave 0**: the split keeps the old cascade order (files are imported in the order base, layout, buttons, header, board, panel, moves, explorer, dialogs, drill, analysis), and screenshots match except engine output.
2. Add the missing tokens to `theme.css`: spacing scale (`--space-1..6`), type scale (`--fs-xs..xl`, `--font-data` with `font-variant-numeric: tabular-nums`), button tiers (`--btn-primary-*`, `--btn-secondary-*`, `--btn-ghost-*`), board-skin tokens (`--hl-last`, `--hl-select`, `--move-dot`, `--arrow-1..3`, `--evalbar-light/dark`).
3. Add `e2e/screens.spec.ts`. It saves PNGs of each screen (picker, Explore after 1.e4 with eval and arrows on, Drill hub, an opening drill in progress, Analyse with a short PGN loaded, Settings, Stats) at both sizes into `screens/` (gitignored). All later agents use it for their before/after shots.
4. Check: the screenshots before and after the split look the same.

### Wave 1 — Shell (1 agent, **Opus**, runs alone)
Owns `index.html` (header and the `.controls` markup), `layout.css`, `header.css`, `buttons.css`, `panel.css`, `src/main.ts` (wiring only).
- Desktop layout: the app fills the screen (`100dvh`), the board column stays put (it is already sticky, in `layout.css`), and the panel scrolls on its own. The board is still capped by window height (keep the `board-row` width formula).
- Panel structure: a sticky top strip (status + verdict) → move controls as icon buttons → moves → mode section → Engine → Explorer. FEN goes into a collapsed `<details>` at the bottom.
- Header: a crest mark (inline SVG knight) next to "Chauss". The mode tabs become a clear segmented control. The opening switcher becomes a distinct "book" chip ("Ponziani · White") that doesn't look like a tab. Settings becomes a gear icon button with a label kept for screen readers.
- Apply the three button tiers. Toggles (Show eval/arrows) become switch-style buttons using `aria-pressed`.
- Swap the favicon for the crest SVG.

**Done in Wave 1.** Notes for later waves:
- Panel order kept the mode section (drill prompt, analysis input) right under the status strip, above the toolbar: it is the "what to do now" part, so it ranks above the moves.
- New classes to reuse: `.btn-primary`, `.btn-ghost`, `.btn-icon` + `<svg class="icon">`, `.icon-only`, `.toolbar`, `.switch` (state in `aria-pressed`). A plain `<button>` is the secondary tier.
- The eval/arrow toggles now have fixed labels ("Eval bar", "Best-move arrows"); `enginePanel.ts` only sets `aria-pressed`.
- The FEN sits in a closed `<details>`: tests read it with `textContent`, not `innerText`.
- On wide screens the page never scrolls: `.panel` and `.drill-hub` are the scroll containers.

### Wave 2 — Components (3 agents in parallel, each in its own worktree; file sets don't overlap)
**2a. Board skin — Sonnet.** Owns `board.css`, `appearance.css` (non-cursed part only), `src/ui/board.ts` (brush colours and highlight config only), `src/ui/evalBar.ts`, `src/ui/capturedPieces.ts`.
- Add a "Walnut" board as the new default (it goes in the board list in `appearancePanel.ts`'s data source; read-only coordination: only add the entry). Last-move, selected, check and move-dot colours come from the tokens. Arrows use `--arrow-1..3`.
- Eval bar: ivory/ink, rounded, 14–18px wide, score in `--font-data`.
- Check that every one of the 10 boards still looks right with the new highlights.

**2b. Study panel content — Sonnet.** Owns `moves.css`, `explorer.css`, `src/ui/moveList.ts`, `src/ui/explorePanel.ts`, `src/ui/enginePanel.ts`.
- Move list: keep the 3-column grid (`n.` | White | Black) at every width, with lighter cells. The current move gets a gold underline or fill, not a wide bar. Verdict marks become small coloured glyphs.
- Explorer: Book and Popular get distinct headers (a small book icon vs a people icon, plus a source tag). Rows get light zebra striping. Moves become plain bold SAN links instead of chip-buttons. W/D/L bars get taller (≥14px) with numbers ≥11px, or numbers move to a tooltip/row. The eval column is right-aligned in the data font.
- Engine lines: the eval in a small badge, then the line in readable SAN.

**2c. Front-door screens — Opus** (most design-heavy). Owns `drill.css`, `dialogs.css`, `src/ui/drillHub.ts`, `src/ui/openingPicker.ts`, `src/ui/settingsPanel.ts`, `src/ui/appearancePanel.ts`, `src/ui/statsDialog.ts`, and the `<dialog>` blocks in `index.html` (Wave 1 is finished, so there's no conflict).
- Drill hub: a centred page with a title and a short lead. Big cards (Openings / Endgames) with an illustrative mini board (a static chessground or SVG of the root position). Under Openings, each opening card shows a side badge, the root line and progress ("N lines due / M learned") from the existing `src/drill/progress.ts` and `srs.ts` (read only).
- Opening picker dialog: the same card design.
- Settings: reorder to Board & pieces → Your level (ratings, speeds) → Game analysis → Advanced (Lichess token, connection test, bundled data). Advanced is collapsed by default. Use a sticky dialog header with a close ✕.
- Stats dialog: tidy table, due rows highlighted with the gold token.
- Drill feedback cards (correct / wrong / solved): a coloured left rule plus an icon and a short entrance animation that respects `prefers-reduced-motion`.

After Wave 2: the orchestrator merges the three branches one at a time and runs the full check after each merge.

**Wave 2 done** (2a board skin, 2b study panel, 2c front-door screens; merged in the order 2b, 2a, 2c). Found while reviewing, for Wave 3:
- The gold best-move arrow (`--arrow-1`, also hard-coded in `src/ui/board.ts`) is faint on light squares; it needs a deeper amber or a dark outline.
- The eval score badge is wider than the 18px bar and pokes past its left edge.
- Neon night board: the last-move highlight looks muddy on navy.
- The hub's mini boards always use Merida pieces and a fixed board, not the user's choice (fine, but say so or follow the choice).
- The large hub card title is 1.6rem, off the type scale.
- The phone header takes three rows (logo + gear, tabs, opening chip).
- Wave 2c added `src/ui/miniBoard.ts` and `src/ui/drillCard.ts` (with tests); the stats table no longer uses `.explore-table`.

### Wave 3 — Polish and QA (1 agent, **Opus**)
- Pass over every screen at 1280×800, 1440×900 and 390×844. Check spacing rhythm, alignment and that there's no horizontal scroll on phones.
- Focus-visible rings (gold, 2px offset) on everything you can interact with. Hover/active states for each button tier.
- Contrast audit: all text against its background at least 4.5:1 (small data text included).
- Motion: subtle (≤150ms) transitions on buttons and tabs. None when `prefers-reduced-motion` is set.
- Confirm the cursed set still overrides everything and explodes.
- Final report: a before/after screenshot grid of each screen. Update CLAUDE.md only if the styling layout (`src/styles/`) needs a line.

### How to run it (orchestrator)
Use one Opus session as orchestrator. It runs Wave 0 and Wave 1 itself, one after the other. It then starts 2a/2b/2c as parallel sub-agents with `isolation: "worktree"` and the briefs above, reviews each report and its screenshots, merges, then runs Wave 3. Model choice: Opus for anything that makes design decisions (0, 1, 2c, 3). Sonnet for 2a and 2b, which are well-specified restyles.

## Verification (end to end)
- `npm run build`, `npm test`, `npm run test:e2e` all green.
- `npx playwright test e2e/screens.spec.ts` produces the screen set. Compare it with the Wave 0 "before" set.
- Manual check in the browser pane at desktop and phone width: the board stays in view while the panel scrolls, the engine responds, eval and arrows use the theme colours, the Drill hub shows progress, Settings opens on Board & pieces, there are no console errors, and the cursed set still works.
- Deploy happens through the existing GitHub Pages workflow only when you push. The agents never push.
