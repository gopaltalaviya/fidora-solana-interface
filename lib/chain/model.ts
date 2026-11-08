/**
 * Chain facts → the API shapes the pages read (lib/api.ts). Pure: no RPC, no
 * clock, so every rule here is unit-tested against fixed inputs.
 *
 * The trust rules are the backend's (fidora-solana-backend src/agents/trust.ts,
 * itself Pactora's), unchanged; `trustScore` and `volume` follow Pactora's
 * packages/db (reputationScoreSql, PER_OWNER_CAP).
 */
import type {AgentView, ChainEvent, ConfigView, JobView} from './fidora';

export const MIN_HISTORY = 3;
export const SELF_FUNDED_SHARE = 0.2;
export const MAX_FAIL_RATE = 0.3;
export const MIN_CLIENT_OWNERS = 3;
export const MAX_TOP_OWNER_SHARE = 0.5;
/** One owner's payments count toward the trust score at most this many times (Pactora). */
export const PER_OWNER_CAP = 3;
/** Finished jobs before a score moves fully away from 50 (Fidora's off-chain confidenceFloor). */
export const CONFIDENCE_FLOOR = 25;

export type Verdict = 'trusted' | 'new' | 'concentrated' | 'self-funded' | 'failing';

// ── the agent card ───────────────────────────────────────────────────────

export interface Card {
  name: string;
  capability: string | null;
  price: string | null;
}

/**
 * What an agent's on-chain card URI says about it, without fetching it.
 * `data:,<name>` (the demo's orchestrator), or an http(s) URL whose fragment
 * carries `n`, `c`, `p` (name, capability, price in base units). Fetching is
 * deliberately not done: a server that fetches any URL an agent registers is
 * a request-forgery tool, and the card is the agent's own claim either way.
 */
export function parseCard(uri: string, id: string): Card {
  const fallback: Card = {name: `Agent #${id}`, capability: null, price: null};
  if (uri.startsWith('data:')) {
    const text = decodeURIComponent(uri.slice(uri.indexOf(',') + 1)).trim();
    return text && text.length <= 64 ? {...fallback, name: text} : fallback;
  }
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return fallback;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
  const f = new URLSearchParams(url.hash.replace(/^#/, ''));
  const name = (f.get('n') ?? '').trim();
  const capability = (f.get('c') ?? '').trim();
  const price = f.get('p') ?? '';
  return {
    name: name && name.length <= 64 ? name : fallback.name,
    capability: /^[a-z0-9][a-z0-9-]{0,47}$/.test(capability) ? capability : null,
    price: /^\d{1,20}$/.test(price) ? price : null,
  };
}

// ── money ────────────────────────────────────────────────────────────────

export function formatUsdc(base: string, decimals = 6): string {
  const neg = base.startsWith('-');
  const digits = (neg ? base.slice(1) : base).padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals).replace(/^0+(?=\d)/, '');
  const frac = digits.slice(-decimals).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

// ── reputation ───────────────────────────────────────────────────────────

/** Average review (0–100) the escrow recorded; 50 before any review. */
export function reviewScore(a: AgentView): number {
  const r = a.workerRecord;
  return r.reviews > 0 ? Math.round(r.reviewScoreSum / r.reviews) : 50;
}

const idiv = (a: number, b: number) => Math.trunc(a / b);

/** Pactora's reputationScoreSql in integer arithmetic, as Postgres runs it. */
export function reputationScore(completed: number, failed: number, floor = CONFIDENCE_FLOOR): number {
  const n = completed + failed;
  const rate = idiv(100 * (completed + 1), n + 2);
  const confidence = Math.min(100, idiv(n * 100, floor));
  return Math.max(0, Math.min(100, 50 + idiv((rate - 50) * confidence, 100)));
}

// ── agents ───────────────────────────────────────────────────────────────

export interface AgentSummaryOut {
  agentId: number;
  chainId: string;
  chainAgentId: string;
  name: string;
  description: string | null;
  capabilities: string[];
  pricePerTask: string;
  priceDisplay: string;
  walletAddress: string;
  ownerAddress: string;
  score: number;
  completed: number;
  failed: number;
  successRate: number | null;
  active: boolean;
  frozen: boolean;
  stake: string;
  explorerUrl: string;
  skills: {
    capability: string;
    completed: number;
    failed: number;
    successRate: number | null;
    score: number;
  }[];
}

export function agentSummary(
  a: AgentView,
  ctx: {network: string; minStake: string; explorerAddress: (addr: string) => string},
): AgentSummaryOut {
  const card = parseCard(a.cardUri, a.id);
  const completed = a.workerRecord.completed;
  const failed = a.workerRecord.failed + a.workerRecord.disputesLost;
  const finished = completed + failed;
  const successRate = finished > 0 ? completed / finished : null;
  const free = BigInt(a.stake.available) - BigInt(a.stake.locked);
  const score = reviewScore(a);
  const price = card.price ?? '0';
  return {
    agentId: Number(a.id),
    chainId: ctx.network,
    chainAgentId: a.id,
    name: card.name,
    description: card.capability ? null : 'Client agent: hires others, offers no paid skill.',
    capabilities: card.capability ? [card.capability] : [],
    pricePerTask: price,
    priceDisplay: card.price ? `${formatUsdc(card.price)} USDC` : '—',
    walletAddress: a.wallet ?? '',
    ownerAddress: a.owner,
    score,
    completed,
    failed,
    successRate,
    // Hireable by the protocol's own rule (orchestrator discovery): a wallet,
    // not frozen, a paid skill, and the minimum stake unlocked.
    active: Boolean(a.wallet) && !a.frozen && card.capability !== null && free >= BigInt(ctx.minStake),
    frozen: a.frozen,
    stake: a.stake.available,
    explorerUrl: ctx.explorerAddress(a.address),
    skills: card.capability ? [{capability: card.capability, completed, failed, successRate, score}] : [],
  };
}

export type Rank = 'balanced' | 'quality' | 'cheapest' | 'fastest';

/** The list the agents page shows: workers only, filtered, ranked like Pactora's modes. */
export function rankAgents(
  all: AgentSummaryOut[],
  q: {
    rank?: string | undefined;
    capability?: string | undefined;
    minScore?: number | undefined;
    limit?: number | undefined;
  },
): AgentSummaryOut[] {
  const rank = (
    ['balanced', 'quality', 'cheapest', 'fastest'].includes(q.rank ?? '') ? q.rank : 'balanced'
  ) as Rank;
  let rows = all.filter((a) => a.capabilities.length > 0);
  if (q.capability) rows = rows.filter((a) => a.capabilities.includes(q.capability!));
  if (q.minScore !== undefined) rows = rows.filter((a) => a.score >= q.minScore!);
  const price = (a: AgentSummaryOut) => Number(a.pricePerTask) || Number.MAX_SAFE_INTEGER;
  const cmp: Record<Rank, (a: AgentSummaryOut, b: AgentSummaryOut) => number> = {
    quality: (a, b) => b.score - a.score || b.completed - a.completed,
    cheapest: (a, b) => price(a) - price(b) || b.score - a.score,
    // No latency is recorded on chain; settled count is the nearest honest proxy.
    fastest: (a, b) => b.completed - a.completed || b.score - a.score,
    balanced: (a, b) =>
      b.score * 2 - price(b) / 10_000 - (a.score * 2 - price(a) / 10_000) || b.completed - a.completed,
  };
  rows.sort((a, b) => Number(b.active) - Number(a.active) || cmp[rank](a, b));
  return rows.slice(0, Math.max(1, Math.min(100, q.limit ?? 50)));
}

// ── trust ────────────────────────────────────────────────────────────────

export interface TrustOut {
  agentId: string;
  chainId: string;
  verdict: Verdict;
  action: 'allow' | 'warn' | 'block';
  reasons: string[];
  metrics: {
    settled: number;
    failed: number;
    volume: string;
    clientOwners: number;
    topOwnerSettled: number;
    selfFunded: number;
    trustScore: number;
  };
  fundingWindowBlocks: number;
  indexedToBlock: string | null;
  complete: boolean;
}

export function actionOf(v: Verdict): 'allow' | 'warn' | 'block' {
  if (v === 'trusted') return 'allow';
  if (v === 'new' || v === 'concentrated') return 'warn';
  return 'block';
}

export function verdictOf(m: {
  settled: number;
  failed: number;
  clientOwners: number;
  topOwnerSettled: number;
  selfFunded: number;
}): {
  verdict: Verdict;
  reasons: string[];
} {
  const finished = m.settled + m.failed;
  const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;
  if (m.selfFunded > 0 && m.selfFunded / Math.max(1, m.settled) >= SELF_FUNDED_SHARE) {
    return {
      verdict: 'self-funded',
      reasons: [
        `${m.selfFunded} of ${m.settled} paid jobs (${pct(m.selfFunded, m.settled)}) were paid by a client that had been funded from this worker's side`,
      ],
    };
  }
  if (finished < MIN_HISTORY) {
    return {
      verdict: 'new',
      reasons: [`${finished} finished job(s); at least ${MIN_HISTORY} are needed to judge`],
    };
  }
  if (m.failed / finished > MAX_FAIL_RATE) {
    return {
      verdict: 'failing',
      reasons: [
        `${m.failed} of ${finished} finished jobs (${pct(m.failed, finished)}) failed or were lost in a dispute`,
      ],
    };
  }
  const reasons: string[] = [];
  if (m.clientOwners < MIN_CLIENT_OWNERS)
    reasons.push(`paid by only ${m.clientOwners} distinct owner(s); ${MIN_CLIENT_OWNERS} or more are needed`);
  if (m.settled > 0 && m.topOwnerSettled / m.settled > MAX_TOP_OWNER_SHARE)
    reasons.push(
      `one owner paid for ${m.topOwnerSettled} of ${m.settled} jobs (${pct(m.topOwnerSettled, m.settled)})`,
    );
  if (reasons.length > 0) return {verdict: 'concentrated', reasons};
  return {
    verdict: 'trusted',
    reasons: [
      `${m.settled} paid jobs from ${m.clientOwners} distinct owners; none self-funded; ${pct(m.failed, finished)} failed`,
    ],
  };
}

/**
 * Every agent's trust reading from one pass over the program's events:
 * `Funded` (who put money into which agent), `JobCreated` + `JobSettled` and
 * `DirectPaid` (who paid whom). An incomplete scan blocks everyone.
 */
export function trustAll(
  agents: AgentView[],
  events: ChainEvent[],
  ctx: {network: string; complete: boolean; maxTransactions: number; slot: number | null},
): Map<string, TrustOut> {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const funded: {agentId: string; from: string; slot: number}[] = [];
  const created = new Map<string, {client: string; worker: string; amount: string}>();
  const paid: {jobId: string; client: string; worker: string; amount: string; slot: number}[] = [];
  for (const e of events) {
    const d = e.data;
    if (e.name === 'Funded') {
      if (d['kind'] === '0') funded.push({agentId: d['agentId']!, from: d['from']!, slot: e.slot});
    } else if (e.name === 'JobCreated') {
      created.set(d['jobId']!, {client: d['client']!, worker: d['worker']!, amount: d['amount']!});
    } else if (e.name === 'DirectPaid') {
      paid.push({
        jobId: d['jobId']!,
        client: d['client']!,
        worker: d['worker']!,
        amount: d['amount']!,
        slot: e.slot,
      });
    } else if (e.name === 'JobSettled') {
      const cr = created.get(d['jobId']!);
      if (cr && !paid.some((p) => p.jobId === d['jobId']))
        paid.push({jobId: d['jobId']!, ...cr, slot: e.slot});
    }
  }
  const out = new Map<string, TrustOut>();
  for (const w of agents) {
    const side = new Set<string>([w.owner]);
    for (const a of agents) if (a.owner === w.owner && a.wallet) side.add(a.wallet);
    const mine = paid.filter((x) => x.worker === w.id);
    const owners = new Map<string, {n: number; clean: number}>();
    let selfFunded = 0;
    let volume = 0n;
    for (const x of mine) {
      const owner = byId.get(x.client)?.owner ?? `agent:${x.client}`;
      const flagged = funded.some((f) => f.agentId === x.client && side.has(f.from) && f.slot <= x.slot);
      if (flagged) selfFunded++;
      const o = owners.get(owner) ?? {n: 0, clean: 0};
      o.n++;
      if (!flagged) o.clean++;
      owners.set(owner, o);
      volume += BigInt(x.amount || '0');
    }
    const failed = w.workerRecord.failed + w.workerRecord.disputesLost;
    const effective = [...owners.values()].reduce((t, o) => t + Math.min(o.clean, PER_OWNER_CAP), 0);
    const metrics = {
      settled: mine.length,
      failed,
      volume: volume.toString(),
      clientOwners: owners.size,
      topOwnerSettled: Math.max(0, ...[...owners.values()].map((o) => o.n)),
      selfFunded,
      trustScore: reputationScore(effective, failed),
    };
    const v = verdictOf(metrics);
    const reading: TrustOut = {
      agentId: w.id,
      chainId: ctx.network,
      verdict: v.verdict,
      action: actionOf(v.verdict),
      reasons: v.reasons,
      metrics,
      fundingWindowBlocks: 0,
      indexedToBlock: ctx.slot === null ? null : String(ctx.slot),
      complete: ctx.complete,
    };
    out.set(
      w.id,
      ctx.complete
        ? reading
        : {
            ...reading,
            action: 'block',
            reasons: [
              `the program history is not fully read yet (it stops at the newest ${ctx.maxTransactions} transactions, and a rate-limited RPC is read over several requests), so this record may be missing evidence; no agent is cleared on partial evidence`,
              ...reading.reasons,
            ],
          },
    );
  }
  return out;
}

// ── jobs and activity ────────────────────────────────────────────────────

/** A one-line, human sentence for an event; amounts in USDC. */
export function describeEvent(e: ChainEvent, nameOf: (id: string) => string): string {
  const d = e.data;
  const usdc = (k: string) => `${formatUsdc(d[k] ?? '0')} USDC`;
  switch (e.name) {
    case 'AgentRegistered':
      return `${nameOf(d['agentId']!)} registered`;
    case 'Funded':
      return `${usdc('amount')} ${d['kind'] === '1' ? 'staked on' : 'added to the purse of'} ${nameOf(d['agentId']!)}`;
    case 'Withdrawn':
      return `${usdc('amount')} withdrawn by ${nameOf(d['agentId']!)}`;
    case 'JobCreated':
      return `Job #${d['jobId']}: ${nameOf(d['client']!)} locked ${usdc('amount')} in escrow to hire ${nameOf(d['worker']!)}`;
    case 'JobAccepted':
      return `Job #${d['jobId']} accepted by the worker`;
    case 'ResultSubmitted':
      return `Job #${d['jobId']}: result delivered; its hash is now on chain`;
    case 'JobDisputed':
      return `Job #${d['jobId']} disputed by the client`;
    case 'DisputeResolved':
      return `Job #${d['jobId']}: the arbiter ruled`;
    case 'DisputeExpired':
      return `Job #${d['jobId']}: the dispute timed out`;
    case 'JobSettled':
      return `Job #${d['jobId']} settled: ${usdc('paid')} paid to ${nameOf(d['worker']!)} (${d['outcome'] || 'success'})`;
    case 'JobRefunded':
      return `Job #${d['jobId']} refunded: ${usdc('amount')} back to ${nameOf(d['client']!)} (${d['reason'] || 'refund'})`;
    case 'Review':
      return `Job #${d['jobId']}: ${nameOf(d['agentId']!)} reviewed ${d['value']}/100 as ${d['side'] === '1' ? 'client' : 'worker'}`;
    case 'DirectPaid':
      return `Direct payment of ${usdc('amount')} from ${nameOf(d['client']!)} to ${nameOf(d['worker']!)}`;
    case 'BondSeized':
      return `Job #${d['jobId']}: the worker's bond was seized`;
    case 'CapsSet':
      return `${nameOf(d['agentId']!)} changed its spending caps`;
    case 'AgentFrozen':
      return `${nameOf(d['agentId']!)} was frozen`;
    default:
      return e.name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
}

/** The ids an event is about, for filtering a job's or an agent's history. */
export function eventRefs(e: ChainEvent): {jobId: string | null; agentIds: string[]} {
  const d = e.data;
  return {
    jobId: d['jobId'] ?? null,
    agentIds: ['agentId', 'client', 'worker'].map((k) => d[k]).filter((v): v is string => Boolean(v)),
  };
}

export interface ActivityItem {
  kind: string;
  summary: string;
  jobId: string | null;
  agentIds: string[];
  slot: number;
  at: string | null;
  signature: string;
  explorerUrl: string;
}

export function activity(
  events: ChainEvent[],
  ctx: {nameOf: (id: string) => string; explorerTx: (sig: string) => string},
): ActivityItem[] {
  return events.map((e) => ({
    kind: e.name,
    summary: describeEvent(e, ctx.nameOf),
    ...eventRefs(e),
    slot: e.slot,
    at: e.blockTime ? new Date(e.blockTime * 1000).toISOString() : null,
    signature: e.signature,
    explorerUrl: ctx.explorerTx(e.signature),
  }));
}

/** The vault must hold exactly what the program says it owes (invariant I1). */
export function invariantI1(
  cfg: ConfigView,
  vault: string | null,
): {holds: boolean | null; owed: string; vault: string | null} {
  const t = cfg.totals;
  const owed = [t.locked, t.disputeBonds, t.balances, t.stakes, t.feesOwed]
    .reduce((s, v) => s + BigInt(v), 0n)
    .toString();
  return {holds: vault === null ? null : vault === owed, owed, vault};
}

export interface JobOut extends JobView {
  chainId: string;
  amountDisplay: string;
  clientName: string;
  workerName: string;
  explorerUrl: string;
  events: ActivityItem[];
}

export function jobOut(
  j: JobView,
  events: ChainEvent[],
  ctx: {
    network: string;
    nameOf: (id: string) => string;
    explorerTx: (sig: string) => string;
    explorerAddress: (a: string) => string;
  },
): JobOut {
  return {
    ...j,
    chainId: ctx.network,
    amountDisplay: `${formatUsdc(j.amount)} USDC`,
    clientName: ctx.nameOf(j.client),
    workerName: ctx.nameOf(j.worker),
    explorerUrl: ctx.explorerAddress(j.address),
    events: activity(
      events.filter((e) => e.data['jobId'] === j.id),
      ctx,
    ),
  };
}
