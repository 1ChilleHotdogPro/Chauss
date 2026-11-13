# Stockfish engine files

These files are the **Stockfish 19 Lite, single-threaded WASM** build from
[Stockfish.js](https://github.com/nmrugg/stockfish.js) v19.0.1, copied unchanged from
<https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1>.

| File | Size (bytes) | SHA-256 |
| --- | ---: | --- |
| `stockfish-19-lite-single.js` | 28,230 | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| `stockfish-19-lite-single.wasm` | 1,845,971 | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |

- **Why this build:** it is single-threaded, so it needs no `SharedArrayBuffer` and therefore no
  special server headers — GitHub Pages cannot send those. The full-strength single-threaded build
  is 99 MB, too large to ship.
- **Licence:** GPL-3.0. Stockfish.js © Chess.com, LLC; based on Stockfish © the Stockfish developers.
  Source code: <https://github.com/nmrugg/stockfish.js> and <https://github.com/official-stockfish/Stockfish>.
- **`package.json` here** only tells Node that the engine file is a CommonJS script (the rest of the
  project uses ES modules). The browser ignores it.

To update: download the two files of a newer release, replace them, update the table above and the
file name in `src/engine/workerTransport.ts`.
