import {afterEach, describe, expect, it, vi} from 'vitest';
import {api, ApiError, formatUnits} from './api';

/**
 * `formatUnits` turns base units into something a person reads, and it is the
 * only place in this repo that touches money.
 *
 * It had no tests. That is the wrong shape for a function whose failure mode
 * is a number on screen that is wrong by a factor of a million — during a
 * demo whose entire claim is that the payments are real.
 *
 * The rule it must never break: **the string is the source of truth.** A
 * uint128 amount exceeds 2^53, so anything that routes through a JS number
 * loses precision silently, and the first symptom is a total that does not
 * reconcile with the chain.
 */

describe('formatUnits', () => {
  it('converts USDC base units to a readable amount', () => {
    expect(formatUnits('20000')).toBe('0.02');
    expect(formatUnits('1000000')).toBe('1');
    expect(formatUnits('1500000')).toBe('1.5');
  });

  it('keeps a leading zero rather than emitting a bare dot', () => {
    expect(formatUnits('1')).toBe('0.000001');
    expect(formatUnits('10')).toBe('0.00001');
  });

  it('renders zero as zero', () => {
    expect(formatUnits('0')).toBe('0');
  });

  it('strips trailing zeros without stripping the value', () => {
    expect(formatUnits('100000')).toBe('0.1');
    expect(formatUnits('10000000')).toBe('10');
  });

  /**
   * The one that matters. 2^53 is about 9e15; a uint128 amount is far larger,
   * so an implementation that parsed to a Number would round here and be
   * quietly wrong about a payment.
   */
  it('is exact beyond the range a JS number can represent', () => {
    expect(formatUnits('123456789012345678901234567890')).toBe('123456789012345678901234.56789');
    expect(formatUnits('9007199254740993')).toBe('9007199254.740993');
  });

  it('handles a different decimal count', () => {
    expect(formatUnits('1000000000000000000', 18)).toBe('1');
    expect(formatUnits('1', 18)).toBe('0.000000000000000001');
  });

  it('keeps the sign on a negative amount', () => {
    expect(formatUnits('-20000')).toBe('-0.02');
  });
});

describe('how a failed request reads', () => {
  const answer = (status: number, body: unknown) =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/problem+json'}}),
      );
  afterEach(() => vi.restoreAllMocks());
  const failure = (p: Promise<unknown>) =>
    p.then(
      () => {
        throw new Error('expected the request to fail');
      },
      (e: unknown) => e as ApiError,
    );

  it('a 500 says the API had a problem — never a bare "/v1/agents?… failed (500)"', async () => {
    answer(500, {type: 'x', title: 'Internal error', status: 500, code: 'INTERNAL', traceId: 't'});
    const err = await failure(api.agents({limit: 5}));
    expect(err.message).toMatch(/The server had a problem \(500\)/);
    expect(err.message).not.toMatch(/\/v1\//);
    expect(err.code).toBe('INTERNAL');
  });

  it('a dependency outage (503) says so in words, and promises nothing it cannot know', async () => {
    answer(503, {
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      detail: 'a service this request needs is unavailable',
    });
    const err = await failure(api.agents({limit: 5}));
    expect(err.message).toMatch(/cannot read the Solana network/i);
    expect(err.message).toMatch(/try again/i);
    // Shared with writes: after a failed POST the site cannot know nothing was spent.
    expect(err.message).not.toMatch(/nothing was spent/i);
  });

  it('a 4xx keeps the API’s own explanation', async () => {
    answer(422, {status: 422, code: 'SCHEMA_MISMATCH', detail: 'limit: Number must be at most 100'});
    const err = await failure(api.agents({limit: 5}));
    expect(err.message).toBe('limit: Number must be at most 100');
  });
});

/** The read routes: same origin, exact paths, and the route's own error codes kept. */
describe('the read routes', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) =>
    vi.fn(async (_url: string) => new Response(JSON.stringify(body), {status: 200}));

  it("call this site's own /api routes, with the query only when one is given", async () => {
    const fetchMock = ok({agents: []});
    vi.stubGlobal('fetch', fetchMock);
    await api.agents();
    await api.agents({rank: 'quality', capability: 'market-research', limit: 5});
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/agents');
    expect(fetchMock.mock.calls[1]![0]).toBe(
      '/api/v1/agents?rank=quality&capability=market-research&limit=5',
    );
  });

  it("unwrap the list routes and keep the job route's whole record", async () => {
    vi.stubGlobal('fetch', ok({jobs: [{id: '1'}]}));
    expect(await api.jobs({agent: 4})).toEqual([{id: '1'}]);
    const fetchMock = ok({id: '7', events: []});
    vi.stubGlobal('fetch', fetchMock);
    expect(await api.job('7')).toEqual({id: '7', events: []});
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/jobs/7');
  });

  it('a 404 keeps the route NOT_FOUND code, so a page can say "no such job"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({code: 'NOT_FOUND', detail: 'no job 9'}), {status: 404})),
    );
    await expect(api.job('9')).rejects.toMatchObject({code: 'NOT_FOUND', message: 'no job 9'});
  });

  it('a body that is not JSON reads as a bad response, not a parser error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', {status: 200})),
    );
    await expect(api.status()).rejects.toBeInstanceOf(ApiError);
    await expect(api.status()).rejects.toMatchObject({code: 'BAD_RESPONSE'});
  });
});
