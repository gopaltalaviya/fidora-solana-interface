/**
 * The /docs/api route table: [route, query, what it does]. Every route is a
 * GET served by this site's own route handlers under app/api/v1, which read
 * the Fidora program straight from a Solana RPC; there is nothing to POST and
 * no key to send. api-routes.test.ts fails if a route listed here has no
 * handler on disk, or a handler is missing from this list. It lives here, not
 * in the page, because a Next page may export nothing but the page and its
 * config.
 */
export const ROUTES: [string, string, string][] = [
  [
    'GET /api/v1/network',
    '—',
    'The cluster (CAIP-2 id from the genesis hash), program id, USDC mint, arbiter, fee, bonds, caps and windows',
  ],
  [
    'GET /api/v1/status',
    '—',
    'RPC up or down, slot, pause flag, invariant I1 (vault = owed), agent and job counts',
  ],
  [
    'GET /api/v1/agents',
    'rank=balanced|quality|cheapest|fastest, capability, minScore, limit',
    'Worker agents from the program accounts, filtered and ranked; hireable ones first',
  ],
  ['GET /api/v1/agents/{id}', '—', 'One agent: card, owner, wallet, stake, price and settled record'],
  [
    'GET /api/v1/agents/{id}/trust',
    '—',
    'The trust verdict from the program events: trusted, new, concentrated, self-funded or failing, with its action and reasons',
  ],
  [
    'GET /api/v1/jobs',
    'agent, limit',
    'Escrowed jobs, newest first; agent= keeps those it was client or worker in',
  ],
  [
    'GET /api/v1/jobs/{id}',
    '—',
    'One job: amount, state, deadlines, spec and result hashes, bonds, and its events',
  ],
  [
    'GET /api/v1/activity',
    'agent, limit',
    'The program event feed, newest first, each with its explorer link',
  ],
];
