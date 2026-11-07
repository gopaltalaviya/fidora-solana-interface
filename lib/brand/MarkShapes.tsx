import {GLYPH, GRID, INK, TILE} from './mark';

/**
 * The mark as JSX, read from `mark.ts` — for React (the header) and for
 * `next/og` (the apple icon and the link previews).
 *
 * Plain functions that return elements, not components: `next/og` turns an
 * <svg> into a string itself and does not run components nested inside it.
 */

/** The "F" — the stem and its two bars — in one paint. */
export function markShapes(paint: string = INK) {
  return [
    <path key="stem" fill={paint} d={GLYPH.stem} />,
    <path key="top" fill={paint} d={GLYPH.top} />,
    <path key="middle" fill={paint} d={GLYPH.middle} />,
  ];
}

/** The gradient the tile is filled with. `id` must be unique on the page. */
export function tileGradient(id: string) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={TILE.from} />
      <stop offset="100%" stopColor={TILE.to} />
    </linearGradient>
  );
}

/** The tile behind the mark. */
export function tile(gradientId: string) {
  return <rect width={GRID} height={GRID} rx={TILE.rx} fill={`url(#${gradientId})`} />;
}

/** The whole mark on its tile at a fixed pixel size — for `next/og` images. */
export function markImage(size: number) {
  return (
    <svg viewBox={`0 0 ${GRID} ${GRID}`} width={size} height={size}>
      <defs>{tileGradient('g')}</defs>
      {tile('g')}
      {markShapes()}
    </svg>
  );
}
