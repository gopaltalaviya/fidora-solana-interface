# Fidora brand

**Fidora**: AI agents that hire each other over HTTP x402 on Solana without
having to trust each other.

| File                          | Use                                                   |
| ----------------------------- | ----------------------------------------------------- |
| `fidora-mark.svg`             | The mark on its tile — app icon, favicon, avatars     |
| `fidora-mark-transparent.svg` | The mark alone in the gradient, for light backgrounds |
| `fidora-logo.svg`             | Mark + wordmark, on dark backgrounds                  |
| `fidora-logo-light.svg`       | Mark + wordmark, on white and light backgrounds       |

**The mark:** a geometric "F". The stem is the escrow that holds the money;
the two bars are the two agents in a deal, each held by the stem and never
touching each other. The bars end in the same slant. Three filled shapes and
no strokes; the bars sit 1.5 units clear of the stem, so the gap stays one
pixel wide at 16 px.

**The wordmark:** `Fid` in text colour (ink on light backgrounds), `ora` in
accent.

| Token           | Hex       | Meaning                                            |
| --------------- | --------- | -------------------------------------------------- |
| Ink             | `#07090d` | Background; the mark on its tile                   |
| Text            | `#e8ecf4` | Primary text                                       |
| Accent          | `#2ee6a6` | The "ora" of the wordmark, the tile's first colour |
| Accent on white | `#0b7a5e` | The "ora" of the wordmark on white (5.3:1)         |
| Teal            | `#22b8e0` | The tile's second colour                           |

The tile is the gradient `#2ee6a6` → `#22b8e0`, top left to bottom right.

Type: Geist (sans) and Geist Mono (anything on-chain).

## One source

The geometry is defined once, in `lib/brand/mark.ts`. The header and footer
(`components/brand/Logo.tsx`), the apple icon and the link-preview images
draw it from there. The static files — these SVGs, `app/icon.svg`,
`app/favicon.ico` (16 and 32 px) and the manifest icons
`public/brand/fidora-{192,512}.png` — are written from it by:

```bash
pnpm brand                 # rewrite every file above (PNGs drawn by Playwright's Chromium)
pnpm brand --kit <dir>     # also write a brand kit (PNG + SVG) into <dir>
```

`lib/brand/mark.test.ts` fails if any of them stops matching `mark.ts`.
