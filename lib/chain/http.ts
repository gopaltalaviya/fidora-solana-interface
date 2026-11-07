import 'server-only';
import {NextResponse} from 'next/server';
import {NotFound, UpstreamError} from './service';

/** JSON on success; an RFC 7807 problem the pages already understand (lib/api.ts) otherwise. */
export async function respond(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), {
      headers: {'cache-control': 'public, max-age=5, stale-while-revalidate=30'},
    });
  } catch (e) {
    if (e instanceof NotFound) return problem(404, 'NOT_FOUND', e.message);
    if (e instanceof UpstreamError)
      return problem(503, 'UPSTREAM_UNAVAILABLE', 'The Solana RPC or the Fidora program could not be read.');
    console.error('[api]', e);
    return problem(500, 'INTERNAL', 'Unexpected error.');
  }
}

function problem(status: number, code: string, detail: string) {
  return NextResponse.json(
    {type: 'about:blank', status, code, detail},
    {status, headers: {'content-type': 'application/problem+json'}},
  );
}

/** A u64 id in decimal, or null. */
export const idParam = (v: string) => (/^\d{1,20}$/.test(v) ? v : null);

export function intParam(v: string | null, max: number): number | undefined {
  if (v === null || !/^\d{1,6}$/.test(v)) return undefined;
  return Math.min(max, Number(v));
}
