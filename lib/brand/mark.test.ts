// @vitest-environment happy-dom
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {render} from '@testing-library/react';
import {createElement} from 'react';
import {describe, expect, it} from 'vitest';
import {LogoMark} from '@/components/brand/Logo';
import manifest from '@/app/manifest';
import * as mark from './mark';

const {STATIC_FILES} = mark;

/**
 * The logo used to be copied by hand into seven places with a comment saying
 * "change all three". These tests replace the comment: a static file or a
 * component that no longer draws what `mark.ts` defines is a red test.
 * Regenerate the files with `pnpm brand`.
 */
const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path));

/**
 * The Fidora "F", chosen 2026-11-07. A change to the geometry is a deliberate
 * edit here too.
 */
describe('the mark is the Fidora F', () => {
  it('has exactly the agreed paths', () => {
    expect(mark.GLYPH).toEqual({
      stem: 'M7.5 6H12.5V26H7.5Z',
      top: 'M14 6H24.5L22.5 11H14Z',
      middle: 'M14 13.5H21.5L19.5 18.5H14Z',
    });
  });

  /** Every vertex of a path made of absolute M, H, V, L and Z commands. */
  const vertices = (d: string) => {
    const out: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (const [, cmd, args] of d.matchAll(/([MHVLZ])([^MHVLZ]*)/g)) {
      const n = args!.trim()
        ? args!
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        : [];
      if (cmd === 'M' || cmd === 'L') [x, y] = [n[0]!, n[1]!];
      else if (cmd === 'H') x = n[0]!;
      else if (cmd === 'V') y = n[0]!;
      else continue;
      out.push([x, y]);
    }
    return out;
  };

  it('is centred on the grid', () => {
    const all = Object.values(mark.GLYPH).flatMap(vertices);
    const xs = all.map(([x]) => x);
    const ys = all.map(([, y]) => y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(mark.GRID / 2);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(mark.GRID / 2);
  });

  it('keeps both bars 1.5 units clear of the stem, so the gap survives at 16 px', () => {
    const stemRight = Math.max(...vertices(mark.GLYPH.stem).map(([x]) => x));
    for (const bar of [mark.GLYPH.top, mark.GLYPH.middle]) {
      const left = Math.min(...vertices(bar).map(([x]) => x));
      expect(left - stemRight).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('every static file draws the F, in filled paths, and no rings', () => {
    for (const svg of Object.values(STATIC_FILES).map((f) => f())) {
      for (const d of Object.values(mark.GLYPH)) expect(svg).toContain(`d="${d}"`);
      expect(svg).not.toContain('<circle');
      expect(svg).not.toContain('stroke');
    }
  });
});

describe('the logo has one source', () => {
  for (const [path, svg] of Object.entries(STATIC_FILES)) {
    it(`${path} is exactly what mark.ts draws`, () => {
      expect(read(path).toString('utf8').trim()).toBe(svg());
    });
  }

  it('the header and footer mark draws the same F: the stem and two bars', () => {
    const {container} = render(createElement(LogoMark));
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const paths = [...container.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    expect(paths).toEqual([mark.GLYPH.stem, mark.GLYPH.top, mark.GLYPH.middle]);
  });
});

/** PNG width and height live at bytes 16–23 of the IHDR chunk. */
function pngSize(buf: Buffer): [number, number] {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe('the raster icons exist at the sizes they claim', () => {
  it('favicon.ico holds 16 and 32 px PNG images', () => {
    const ico = read('app/favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      const [w, h] = pngSize(ico.subarray(offset, offset + length));
      expect(w).toBe(h);
      expect(ico[entry] || 256).toBe(w);
      sizes.push(w);
    }
    expect(sizes).toEqual([16, 32]);
  });

  it('every PNG icon in the manifest exists at its stated size', () => {
    const pngs = (manifest().icons ?? []).filter((i) => i.type === 'image/png');
    expect(pngs.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of pngs) {
      const [w, h] = pngSize(read(join('public', icon.src)));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });
});
