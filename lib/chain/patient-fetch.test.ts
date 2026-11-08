/**
 * The site reads the public devnet endpoint, which answers bursts with 429:
 * as the HTTP status, or inside a batch's HTTP 200. Both are waited out;
 * nothing else is retried, and the wait always ends.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {makePatientFetch, patientFetch} from './patient-fetch';

const U = 'https://api.devnet.solana.com';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});

describe('patientFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retries HTTP 429, then returns the first answer that is not limited', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ok: 1}));
    vi.stubGlobal('fetch', f);
    const res = patientFetch(U);
    await vi.runAllTimersAsync();
    expect(await (await res).json()).toEqual({ok: 1});
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('retries a batch whose HTTP 200 carries JSON-RPC error 429 on an item', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        json([
          {id: 1, result: null},
          {id: 2, error: {code: 429, message: 'Too many requests'}},
        ]),
      )
      .mockResolvedValueOnce(
        json([
          {id: 1, result: null},
          {id: 2, result: null},
        ]),
      );
    vi.stubGlobal('fetch', f);
    const res = patientFetch(U);
    await vi.runAllTimersAsync();
    expect(await (await res).json()).toEqual([
      {id: 1, result: null},
      {id: 2, result: null},
    ]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('returns other answers at once, a 429 that is only data included', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({result: {value: 429}}));
    vi.stubGlobal('fetch', f);
    expect((await patientFetch(U)).status).toBe(500);
    expect((await patientFetch(U)).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('retries a dropped connection, but rethrows any other error at once', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('{}', {status: 200}));
    vi.stubGlobal('fetch', f);
    const res = patientFetch('https://api.devnet.solana.com');
    await vi.runAllTimersAsync();
    expect((await res).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new RangeError('not a network error')));
    await expect(patientFetch('https://api.devnet.solana.com')).rejects.toThrow(RangeError);
  });

  it('gives up after 13 tries and hands the 429 back', async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockImplementation(async () => json({}, 429));
    vi.stubGlobal('fetch', f);
    const res = patientFetch(U);
    await vi.runAllTimersAsync();
    expect((await res).status).toBe(429);
    expect(f).toHaveBeenCalledTimes(13);
  });
});

describe('makePatientFetch({maxWaitMs})', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('hands the 429 back once the next wait would pass the bound, so a page answers in time', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // no jitter: 1+2+4 s must fit in 8 s exactly, every run
    const f = vi.fn().mockImplementation(async () => new Response('{}', {status: 429}));
    vi.stubGlobal('fetch', f);
    const res = makePatientFetch({maxWaitMs: 8_000})('https://api.devnet.solana.com');
    await vi.runAllTimersAsync();
    expect((await res).status).toBe(429);
    // waits of ~1, 2, 4 s fit in 8 s; the next (~8 s) does not
    expect(f).toHaveBeenCalledTimes(4);
  });
});
