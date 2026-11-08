/**
 * The public devnet endpoint answers bursts with 429 — as the HTTP status,
 * or, for a batch, inside an HTTP 200 as JSON-RPC error 429 on its items.
 * Either is retried (1, 2, 4 … capped at 30 s, plus jitter, at most 13
 * tries); a dropped connection (a fetch TypeError) is retried the same way;
 * every other answer and error is returned unchanged.
 *
 * `maxWaitMs` bounds the total time spent waiting between tries: once the
 * next wait would pass it, the last answer (or error) is handed back. A page
 * request must answer inside a serverless time limit, so the site uses a
 * bound; scripts can afford to wait.
 */
export function makePatientFetch({maxWaitMs = Infinity}: {maxWaitMs?: number} = {}) {
  return async function patientFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    let waited = 0;
    for (let attempt = 0; ; attempt++) {
      const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
      const canWait = attempt < 12 && waited + delay <= maxWaitMs;
      let res;
      try {
        res = await fetch(url, init);
      } catch (e) {
        // A dropped connection (undici: "fetch failed") under load: retried too.
        if (!canWait || !(e instanceof TypeError)) throw e;
        await new Promise((r) => setTimeout(r, delay));
        waited += delay;
        continue;
      }
      const limited = res.status === 429 || (res.ok && /"code"\s*:\s*429\b/.test(await res.clone().text()));
      if (!limited || !canWait) return res;
      await new Promise((r) => setTimeout(r, delay));
      waited += delay;
    }
  };
}

export const patientFetch = makePatientFetch();
