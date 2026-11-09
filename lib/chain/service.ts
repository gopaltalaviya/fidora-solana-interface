/**
 * What each `/api/v1/*` route answers, assembled from the chain. Server-only.
 * Errors from the RPC surface as `UpstreamError` → 503, so the pages show
 * their "temporarily unavailable" state instead of a stack trace.
 */
import 'server-only';
import {
  MAX_TRANSACTIONS,
  cluster,
  readAgents,
  readConfig,
  readEvents,
  readJobEvents,
  readJobs,
  readSlot,
  readVaultBalance,
  PROGRAM_ID,
} from './fidora';
import {activity, agentSummary, invariantI1, jobOut, parseCard, rankAgents, trustAll} from './model';

export class UpstreamError extends Error {}
export class NotFound extends Error {}

async function upstream<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof NotFound) throw e;
    throw new UpstreamError((e as Error).message);
  }
}

async function base() {
  const c = await upstream(cluster());
  const cfg = await upstream(readConfig());
  if (!cfg) throw new UpstreamError('the Fidora program is not initialized on this cluster');
  return {c, cfg};
}

async function names() {
  const agents = await upstream(readAgents());
  const map = new Map(agents.map((a) => [a.id, parseCard(a.cardUri, a.id).name]));
  return {agents, nameOf: (id: string) => map.get(id) ?? `Agent #${id}`};
}

export async function network() {
  const {c, cfg} = await base();
  const p = cfg.params;
  return {
    chainId: c.network,
    cluster: c.name,
    name: c.name === 'devnet' ? 'Solana devnet' : 'Solana localnet',
    shortName: c.name,
    testnet: true,
    programId: PROGRAM_ID.toBase58(),
    paymentToken: {symbol: 'USDC', decimals: 6, accountId: cfg.mint},
    contracts: {Fidora: PROGRAM_ID.toBase58(), PaymentToken: cfg.mint, Arbiter: cfg.arbiter},
    rpcUrls: c.name === 'devnet' ? ['https://api.devnet.solana.com'] : [],
    nativeCurrency: {name: 'SOL', symbol: 'SOL', decimals: 9},
    explorerBaseUrl: c.name === 'devnet' ? 'https://explorer.solana.com/?cluster=devnet' : null,
    faucetUrls: c.name === 'devnet' ? ['https://faucet.solana.com'] : [],
    paused: cfg.paused,
    fastPathMaxDisplay: p.fastPathMax,
    protocolFeeBps: p.protocolFeeBps,
    minJobAmount: p.minJobAmount,
    minFee: p.minFee,
    windows: {
      accept: p.maxAcceptWindow,
      work: p.maxWorkWindow,
      review: p.reviewWindow,
      dispute: p.disputeTimeout,
    },
    bondBps: p.bondBps,
    minBond: p.minBond,
    disputeBondBps: p.disputeBondBps,
    minDisputeBond: p.minDisputeBond,
    maxJobAmount: p.maxJobAmount,
    defaultPerTaskCap: p.defaultPerTaskCap,
    defaultDailyCap: p.defaultDailyCap,
    minStake: p.minStake,
    withdrawDelaySeconds: p.withdrawDelay,
  };
}

async function summaries() {
  const {c, cfg} = await base();
  const agents = await upstream(readAgents());
  const ctx = {network: c.network, minStake: cfg.params.minStake, explorerAddress: c.explorerAddress};
  return agents.map((a) => agentSummary(a, ctx));
}

export async function agents(q: {
  rank?: string | undefined;
  capability?: string | undefined;
  minScore?: number | undefined;
  limit?: number | undefined;
}) {
  return {agents: rankAgents(await summaries(), q)};
}

export async function agent(id: string) {
  const found = (await summaries()).find((a) => a.chainAgentId === id);
  if (!found) throw new NotFound(`no agent ${id}`);
  return found;
}

export async function trust(id: string) {
  const c = await upstream(cluster());
  const [agentsList, scan, slot] = await Promise.all([
    upstream(readAgents()),
    upstream(readEvents()),
    upstream(readSlot()),
  ]);
  const t = trustAll(agentsList, scan.events, {
    network: c.network,
    complete: scan.complete,
    maxTransactions: MAX_TRANSACTIONS,
    slot,
  }).get(id);
  if (!t) throw new NotFound(`no agent ${id}`);
  return t;
}

export async function jobs(q: {agent?: string | undefined; limit?: number | undefined}) {
  const c = await upstream(cluster());
  const [list, scan, n] = await Promise.all([upstream(readJobs()), upstream(readEvents()), names()]);
  const ctx = {
    network: c.network,
    nameOf: n.nameOf,
    explorerTx: c.explorerTx,
    explorerAddress: c.explorerAddress,
  };
  const rows = list
    .filter((j) => !q.agent || j.client === q.agent || j.worker === q.agent)
    .reverse()
    .slice(0, Math.max(1, Math.min(200, q.limit ?? 50)));
  return {jobs: rows.map((j) => ({...jobOut(j, scan.events, ctx), events: undefined}))};
}

export async function job(id: string) {
  const c = await upstream(cluster());
  const [list, n] = await Promise.all([upstream(readJobs()), names()]);
  const j = list.find((x) => x.id === id);
  if (!j) throw new NotFound(`no job ${id}`);
  // Every instruction of a job touches its account, so the account's own transactions (a handful)
  // carry all of its events; the program-wide scan is only the fallback.
  const events = await readJobEvents(j.address).catch(async () => (await upstream(readEvents())).events);
  return jobOut(j, events, {
    network: c.network,
    nameOf: n.nameOf,
    explorerTx: c.explorerTx,
    explorerAddress: c.explorerAddress,
  });
}

export async function activityFeed(q: {agent?: string | undefined; limit?: number | undefined}) {
  const c = await upstream(cluster());
  const [scan, n] = await Promise.all([upstream(readEvents()), names()]);
  const items = activity(scan.events, {nameOf: n.nameOf, explorerTx: c.explorerTx})
    .filter((i) => !q.agent || i.agentIds.includes(q.agent))
    .reverse()
    .slice(0, Math.max(1, Math.min(200, q.limit ?? 50)));
  return {events: items, complete: scan.complete};
}

export async function status() {
  const checkedAt = new Date().toISOString();
  try {
    const {c, cfg} = await base();
    const [slot, vault, agentsList, list] = await Promise.all([
      upstream(readSlot()),
      upstream(readVaultBalance()),
      upstream(readAgents()),
      upstream(readJobs()),
    ]);
    const i1 = invariantI1(cfg, vault);
    const open = list.filter((j) => j.state !== 'settled' && j.state !== 'refunded').length;
    return {
      status: cfg.paused || i1.holds === false ? 'degraded' : 'operational',
      checkedAt,
      chainId: c.network,
      cluster: c.name,
      rpc: 'up',
      slot,
      programId: PROGRAM_ID.toBase58(),
      paused: cfg.paused,
      invariant: i1,
      counts: {agents: agentsList.length, jobs: list.length, openJobs: open},
      totals: cfg.totals,
    };
  } catch (e) {
    return {
      status: 'down',
      checkedAt,
      chainId: null,
      cluster: null,
      rpc: 'down',
      slot: null,
      programId: PROGRAM_ID.toBase58(),
      paused: null,
      invariant: null,
      counts: null,
      totals: null,
      // States only, never the RPC's own error text (it can carry a URL).
      detail:
        e instanceof UpstreamError ? 'The Solana RPC or the program could not be read.' : 'Unexpected error.',
    };
  }
}
