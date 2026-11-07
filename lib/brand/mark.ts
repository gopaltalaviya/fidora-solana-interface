/**
 * The Fidora mark: a geometric "F". The stem is the escrow that holds; the two
 * bars are the two agents in a deal, each held by the stem and never touching
 * each other. The bars end in the same slant, a nod to Solana's own mark.
 *
 * This file is the ONLY place the geometry is defined. Everything that draws
 * the mark reads it from here:
 *
 * - `components/brand/Logo.tsx` (header and footer), through `lib/brand/MarkShapes.tsx`
 * - `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`
 * - the static files `app/icon.svg`, `docs/brand/*.svg`, `app/favicon.ico` and
 *   `public/brand/*.png`, which `scripts/brand.mjs` writes from these strings
 *
 * `lib/brand/mark.test.ts` fails if a static file no longer matches, so a
 * change here is a change everywhere or a red test.
 *
 * Plain TypeScript with no imports, so `node --experimental-strip-types`
 * can load it from `scripts/brand.mjs` without a build step.
 */

/** One 32 × 32 grid. */
export const GRID = 32;

/** The tile behind the mark: a rounded square in the brand gradient (green to teal). */
export const TILE = {rx: 8.5, from: '#2ee6a6', to: '#22b8e0'} as const;

/** The colour the mark is drawn in on the tile. */
export const INK = '#07090d';

/** Wordmark colours: "Fid" in text colour, "ora" in accent. */
export const TEXT = '#e8ecf4';
export const ACCENT = '#2ee6a6';
/** "ora" on white: the accent is too faint there; this green is 5.3:1. */
export const ACCENT_ON_LIGHT = '#0b7a5e';

/**
 * The "F": three filled shapes, no strokes. The stem spans x 7.5–12.5 and
 * y 6–26; the bars start 1.5 units clear of it (x 14) and end in a slant.
 * The whole glyph spans x 7.5–24.5, so it is centred on x = 16, y = 16.
 * At 16 px the gap between stem and bars stays one pixel wide.
 */
export const GLYPH = {
  stem: 'M7.5 6H12.5V26H7.5Z',
  top: 'M14 6H24.5L22.5 11H14Z',
  middle: 'M14 13.5H21.5L19.5 18.5H14Z',
} as const;

/**
 * The brand gradient. On the tile it spans the tile's own box. Drawn straight
 * onto a light background (`glyph`), it spans the 32 grid in user space, so
 * the whole glyph is one sweep — the default would give each shape its own.
 */
function gradient(id: string, glyph = false): string {
  const span = glyph
    ? `gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${GRID}" y2="${GRID}"`
    : 'x1="0" y1="0" x2="1" y2="1"';
  return `<linearGradient id="${id}" ${span}><stop offset="0%" stop-color="${TILE.from}"/><stop offset="100%" stop-color="${TILE.to}"/></linearGradient>`;
}

/** The three shapes in one colour (a hex, or `url(#id)`). */
function shapes(paint: string): string {
  const paths = [GLYPH.stem, GLYPH.top, GLYPH.middle].map((d) => `<path d="${d}"/>`).join('');
  return `<g fill="${paint}">${paths}</g>`;
}

/** The mark on its tile, for dark or any background: app icon, favicon, avatars. */
export function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}"><defs>${gradient('g')}</defs><rect width="${GRID}" height="${GRID}" rx="${TILE.rx}" fill="url(#g)"/>${shapes(INK)}</svg>`;
}

/** The mark alone on transparent, drawn in the gradient — for white and light backgrounds. */
export function markTransparentSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}"><defs>${gradient('g', true)}</defs>${shapes('url(#g)')}</svg>`;
}

/** Mark + wordmark, for dark backgrounds. */
export function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40" role="img" aria-label="Fidora"><defs>${gradient('g')}</defs><g transform="translate(4 4)"><rect width="${GRID}" height="${GRID}" rx="${TILE.rx}" fill="url(#g)"/>${shapes(INK)}</g><text x="46" y="29" font-family="Geist, Inter, system-ui, sans-serif" font-size="25" font-weight="600" letter-spacing="-0.6" fill="${TEXT}">Fid<tspan fill="${ACCENT}">ora</tspan></text></svg>`;
}

/** Mark + wordmark for white and light backgrounds: the mark in the gradient, "Fid" in ink. */
export function logoLightSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40" role="img" aria-label="Fidora"><defs>${gradient('g', true)}</defs><g transform="translate(4 4)">${shapes('url(#g)')}</g><text x="46" y="29" font-family="Geist, Inter, system-ui, sans-serif" font-size="25" font-weight="600" letter-spacing="-0.6" fill="${INK}">Fid<tspan fill="${ACCENT_ON_LIGHT}">ora</tspan></text></svg>`;
}

/** Every static file written from this geometry, by repo-relative path. */
export const STATIC_FILES: Record<string, () => string> = {
  'app/icon.svg': markSvg,
  'docs/brand/fidora-mark.svg': markSvg,
  'docs/brand/fidora-mark-transparent.svg': markTransparentSvg,
  'docs/brand/fidora-logo.svg': logoSvg,
  'docs/brand/fidora-logo-light.svg': logoLightSvg,
};
