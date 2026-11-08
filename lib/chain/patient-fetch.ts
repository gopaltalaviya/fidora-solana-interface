/**
 * The public devnet endpoint answers bursts with 429 — as the HTTP status,
 * or, for a batch, inside an HTTP 200 as JSON-RPC error 429 on its items.
 * Either is retried (1, 2, 4 … capped at 30 s, plus jitter, at most 13
 * tries); a dropped connection (a fetch TypeError) is retried the same way; every other answer and error is returned unchanged.
 */
export async function patientFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      // A dropped connection (undici: "fetch failed") under load: retried too.
      if (attempt >= 12 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500));
      continue;
    }
    const limited = res.status === 429 || (res.ok && /"code"\s*:\s*429\b/.test(await res.clone().text()));
    if (!limited || attempt >= 12) return res;
    await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500));
  }
}
