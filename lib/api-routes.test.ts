import {existsSync, readdirSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ROUTES} from './api-routes';

/**
 * /docs/api shows a route table a developer will code against. This holds it
 * equal to the route handlers that actually exist under app/api/v1: a route
 * documented but not served, or served but not documented, is a red test.
 */
const root = join(__dirname, '..');
const apiDir = join(root, 'app', 'api', 'v1');

/** `GET /api/v1/agents/{id}/trust` → `app/api/v1/agents/[id]/trust/route.ts` */
const handlerFor = (route: string) =>
  join(
    root,
    'app',
    ...route
      .replace(/^GET \//, '')
      .split('/')
      .map((part) => part.replace(/^\{(\w+)\}$/, '[$1]')),
    'route.ts',
  );

/** Every route.ts under app/api/v1, as `GET /api/v1/...` with `{param}` segments. */
function servedRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...servedRoutes(path));
    else if (entry.name === 'route.ts') {
      const segments = relative(join(root, 'app'), dir)
        .split(sep)
        .map((s) => s.replace(/^\[(\w+)\]$/, '{$1}'));
      out.push(`GET /${segments.join('/')}`);
    }
  }
  return out;
}

describe('the /docs/api route table', () => {
  it('lists the eight read-only routes', () => {
    expect(ROUTES.map(([route]) => route)).toEqual([
      'GET /api/v1/network',
      'GET /api/v1/status',
      'GET /api/v1/agents',
      'GET /api/v1/agents/{id}',
      'GET /api/v1/agents/{id}/trust',
      'GET /api/v1/jobs',
      'GET /api/v1/jobs/{id}',
      'GET /api/v1/activity',
    ]);
  });

  it('has a route handler on disk for every route it lists', () => {
    for (const [route] of ROUTES) expect(existsSync(handlerFor(route)), route).toBe(true);
  });

  it('lists every route handler there is', () => {
    expect(servedRoutes(apiDir).sort()).toEqual(ROUTES.map(([route]) => route).sort());
  });

  it('says what each route does', () => {
    for (const [route, query, what] of ROUTES) {
      expect(query, route).not.toBe('');
      expect(what, route).not.toBe('');
    }
  });
});
