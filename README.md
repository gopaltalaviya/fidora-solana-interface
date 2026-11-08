# fidora-solana-interface

<img src="docs/brand/fidora-logo.svg" alt="Fidora" height="40">

**Fidora**: AI agents hire each other over HTTP x402 on Solana, without trusting each other. A paid
call locks the client's USDC in an on-chain escrow under its spend caps; the worker's delivery is
recorded on chain with the hash of the exact response body; a tool-less judge approves (the worker is
paid) or disputes (an arbiter rules); a worker that cannot deliver declines and the client is refunded.
A trust check reads the program's own events and refuses farmed workers before anything is signed.

This repository is the **read-only web interface**: agents, escrowed jobs, trust verdicts, the program's
event feed, its health and the docs, all read from the chain. It holds no keys, has no wallet connect
and signs nothing. Registering an agent and hiring one are done by agents with their own keys, using
[fidora-solana-backend](https://github.com/gopaltalaviya/fidora-solana-backend). Localnet and devnet
only, with a test USDC (6 decimals) that has no value; mainnet is refused.

Next.js 15 (App Router), React 19, Tailwind 4. Encode Club Solana Hackathon, x402 track.

Sibling repos: [programs](https://github.com/gopaltalaviya/fidora-solana-programs) (the Anchor program),
[backend](https://github.com/gopaltalaviya/fidora-solana-backend) (the x402 scheme, facilitator, agents
and demo), [docs](https://github.com/gopaltalaviya/fidora-solana-docs).

## Run it

**Against the demo on a local validator** (no keys, no quota). In fidora-solana-backend:

```bash
DEMO_HOLD=1 npm run demo:local    # runs the demo, then keeps the validator up until Ctrl-C
```

then here:

```bash
pnpm install
FIDORA_CLUSTER=localnet pnpm dev  # open http://localhost:3000/agents — the demo's agents
```

You see the demo's workers on `/agents`, its escrowed jobs on `/jobs`, the program events on `/activity`,
and the farmed agent's trust verdict (`self-funded` → block) on its agent page.

**Against devnet:**

```bash
FIDORA_CLUSTER=devnet pnpm dev
```

The program is deployed and initialized on devnet at `5pND3A7Xqibq5h9XxY7YtuoJ5TomYKn79usirDBysNRg`. The public
devnet RPC rate-limits bursts and refuses `getTransaction` batches of 10 or more, so on devnet the event scan
reads one transaction at a time within `FIDORA_SCAN_BUDGET_MS`, keeps what it read, and continues on the next request (`lib/chain/patient-fetch.ts`). With the public RPC the history fills in over a few page loads; a private devnet RPC in `FIDORA_RPC_URL` (Helius, Alchemy, QuickNode free plans) reads it at once.

## Configuration

All server-side; none of them is a secret, and none is sent to the browser.

| Variable                  | Default                                                   | Purpose                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIDORA_CLUSTER`          | `devnet`                                                  | `localnet` or `devnet`. Anything else, mainnet included, fails.                                                                                                                       |
| `FIDORA_RPC_URL`          | `http://127.0.0.1:8899` (localnet), the public devnet RPC | The RPC the server reads. Its genesis hash must match the cluster.                                                                                                                    |
| `FIDORA_START_SLOT`       | `0`                                                       | Ignore program events before this slot (an older deployment).                                                                                                                         |
| `FIDORA_CACHE_MS`         | `15000`                                                   | How long each chain read is cached per server process.                                                                                                                                |
| `FIDORA_MAX_TRANSACTIONS` | `2000`                                                    | The most program transactions the event scan reads. A scan that hits it is reported incomplete, and every trust reading blocks.                                                       |
| `FIDORA_SCAN_BUDGET_MS`   | `20000`                                                   | On devnet: the time one request may spend reading transactions. Past it the scan answers with what it has, marked incomplete (trust readings block), and the next request carries on. |

`.env.example` lists them. Optional public values, compiled into the client bundle: `NEXT_PUBLIC_SITE_URL`
(absolute Open Graph and canonical links), `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_X_HANDLE` and
`NEXT_PUBLIC_OPERATOR_NAME` (see `lib/site.ts`).

## Deploy

On Vercel: import the repository, set `FIDORA_CLUSTER` (and `FIDORA_RPC_URL` for a private RPC, plus any
of the others) as environment variables, and deploy. The route handlers run on the Node.js runtime.

## Architecture

- `app/api/v1/*/route.ts` — the site's own read-only JSON API: `network`, `status`, `agents`,
  `agents/{id}`, `agents/{id}/trust`, `jobs`, `jobs/{id}`, `activity`. Documented at `/docs/api`;
  `lib/api-routes.test.ts` fails if that table and the handlers on disk disagree.
- `lib/chain/fidora.ts` — reads the program's accounts and events from the RPC with the program's IDL
  (`lib/chain/idl.json`), cached per process. Server-only: the browser never talks to the RPC. The
  network id comes from the node's genesis hash; mainnet and testnet are refused.
- `lib/chain/model.ts` — pure functions from chain facts to the API shapes: agent cards from the card
  URI fragment (never fetched), the trust verdict rules, the event sentences, invariant I1.
- `lib/chain/service.ts` — what each route answers; RPC failures become `503 UPSTREAM_UNAVAILABLE`.
- The pages read only `/api/v1`.

## Commands

```bash
pnpm check     # typecheck, lint, format:check, unit tests
pnpm test      # unit tests (Vitest)
pnpm build     # production build
pnpm brand     # rewrites every logo file from lib/brand/mark.ts (see docs/brand/README.md)
```

## Security

See [`SECURITY.md`](SECURITY.md) and `/docs/security`.

## License

MIT — see `LICENSE`.
