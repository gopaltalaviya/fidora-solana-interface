/**
 * The browser's view of Fidora: the read routes in app/api/v1, which read the
 * Solana program directly (lib/chain). Same origin by default, so one deploy
 * is the whole site; NEXT_PUBLIC_API_URL can point a build at another copy.
 *
 * Only reads exist. Anything that spends is done by an agent holding its own
 * key (fidora-solana-backend), never by a browser.
 */

export const API_URL = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '') ?? '/api';

/** A CAIP-2 network id from the node's genesis hash, e.g. `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet). */
export type ChainId = string;

/** `GET /v1/network`: the cluster, the program, and the on-chain parameters. */
export interface NetworkInfo {
  chainId: ChainId;
  cluster: 'devnet' | 'localnet';
  name: string;
  shortName?: string;
  testnet: boolean;
  programId: string;
  /** `accountId` is the SPL mint of the 6-decimal test USDC. */
  paymentToken: {symbol: string; decimals: number; accountId: string | null};
  contracts: {Fidora: string; PaymentToken: string; Arbiter: string};
  rpcUrls: string[];
  nativeCurrency: {name: string; symbol: string; decimals: number};
  explorerBaseUrl: string | null;
  faucetUrls?: string[];
  paused?: boolean;
  fastPathMaxDisplay: string;
  protocolFeeBps: number;
  /** The smallest job the escrow accepts, in base units. A cheaper agent can never be hired. */
  minJobAmount?: string;
  minFee?: string;
  windows?: {accept: number; work: number; review: number; dispute: number};
  /** The worker's bond, as a share of the job, locked from its stake when it accepts. */
  bondBps?: number;
  minBond?: string;
  /** The client's dispute bond, as a share of the job. */
  disputeBondBps?: number;
  minDisputeBond?: string;
  /** The largest job the escrow accepts. */
  maxJobAmount?: string;
  /** The caps a new agent account starts with. */
  defaultPerTaskCap?: string;
  defaultDailyCap?: string;
  /** The stake an agent needs to be listed as a worker. */
  minStake?: string;
  /** How long a stake withdrawal waits. */
  withdrawDelaySeconds?: number;
}

export interface AgentSummary {
  agentId: number;
  chainId: ChainId;
  /** The agent's id in the program (u64, decimal string). */
  chainAgentId?: string | number | null;
  name: string;
  description: string | null;
  capabilities: string[];
  pricePerTask: string;
  priceDisplay: string;
  walletAddress: string;
  ownerAddress?: string;
  score: number;
  completed: number;
  failed: number;
  successRate: number | null;
  /** Hireable now: a wallet, not frozen, a paid skill, and the minimum stake unlocked. */
  active: boolean;
  frozen?: boolean;
  /** Stake available, base units. */
  stake?: string;
  explorerUrl: string;
  /** When the list was filtered by a capability: the record in that skill alone. */
  skill?: SkillStat;
  /** On a single agent's profile: every skill it offers or has a record in. */
  skills?: SkillStat[];
}

/** Reputation in one skill, counted and scored the same way as the overall figures. */
export interface SkillStat {
  capability: string;
  completed: number;
  failed: number;
  successRate: number | null;
  score: number;
}

/** One program event, decoded. */
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

export type JobState = 'created' | 'accepted' | 'submitted' | 'disputed' | 'settled' | 'refunded';

export interface JobSummary {
  id: string;
  address: string;
  chainId: ChainId;
  client: string;
  worker: string;
  clientName: string;
  workerName: string;
  amount: string;
  amountDisplay: string;
  fee: string;
  state: JobState;
  outcome: string | null;
  acceptDeadline: number;
  workDeadline: number;
  reviewDeadline: number;
  disputeDeadline: number;
  /** sha256 of the request (with a nonce), hex. */
  specHash: string;
  /** sha256 of the exact response body the worker delivered, hex; null until delivery. */
  resultHash: string | null;
  workerBond: string;
  disputeBond: string;
  createdAt: number;
  explorerUrl: string;
}

/** `GET /v1/jobs/:id`: the job and every event that touched it. */
export interface JobDetail extends JobSummary {
  events: ActivityItem[];
}

/** Kept for components that only need the event list. */
export type JobEvents = Pick<JobDetail, 'events'>;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Messages for the two failures that are not the API speaking. */
export const UNREACHABLE = 'Cannot reach Fidora — check your connection, or see the status page.';
export const UNAVAILABLE =
  'Fidora cannot read the Solana network right now — the RPC is busy or down. Try again in a moment.';
export const BAD_RESPONSE =
  'The server sent an unexpected answer (not a valid response) — often a deploy in progress. Try again in a moment.';

/**
 * Every request goes through here, so every failure reads the same way: the
 * route's own RFC 7807 problem when it sent one; otherwise one sentence a
 * person can act on — never "Failed to fetch" or a JSON parser's error.
 */
async function request<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {cache: 'no-store', ...init});
  } catch (err) {
    if ((err as {name?: string})?.name === 'AbortError') throw err;
    throw new ApiError('UNREACHABLE', UNREACHABLE);
  }
  const text = await res.text().catch(() => '');
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const problem = (body ?? {}) as {code?: string; detail?: string};
    if (res.status === 503 || problem.code === 'UPSTREAM_UNAVAILABLE')
      throw new ApiError('UPSTREAM_UNAVAILABLE', UNAVAILABLE);
    if (res.status >= 500)
      throw new ApiError(
        problem.code ?? 'UPSTREAM_UNAVAILABLE',
        `The server had a problem (${res.status}). Try again in a moment.`,
      );
    throw new ApiError(problem.code ?? 'UNKNOWN', problem.detail ?? `${fallback} (${res.status})`);
  }
  if (body === undefined) throw new ApiError('BAD_RESPONSE', BAD_RESPONSE);
  return body as T;
}

function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, signal ? {signal} : {}, `${path} failed`);
}

export type ComponentStatus = 'up' | 'degraded' | 'down' | 'unknown';

/** `GET /v1/status`: states and numbers only, never a host or an error message. */
export interface StatusReport {
  status: 'operational' | 'degraded' | 'down';
  checkedAt: string;
  chainId: ChainId | null;
  cluster: 'devnet' | 'localnet' | null;
  rpc: ComponentStatus;
  slot: number | null;
  programId: string;
  paused: boolean | null;
  /** Invariant I1: the vault holds exactly what the program owes. */
  invariant: {holds: boolean | null; owed: string; vault: string | null} | null;
  counts: {agents: number; jobs: number; openJobs: number} | null;
  totals: {locked: string; disputeBonds: string; balances: string; stakes: string; feesOwed: string} | null;
  detail?: string;
}

/** `GET /v1/agents/:id/trust`: the verdict, its reasons and the numbers behind them. */
export interface TrustReport {
  agentId: string;
  chainId: ChainId;
  verdict: 'trusted' | 'new' | 'concentrated' | 'self-funded' | 'failing';
  action?: 'allow' | 'warn' | 'block';
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
  /** The slot the verdict was read at. */
  indexedToBlock: string | null;
  /** False when the scan hit its bound: the verdict then blocks, whatever the numbers say. */
  complete?: boolean;
}

function query(q: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const api = {
  network: (signal?: AbortSignal) => get<NetworkInfo>('/v1/network', signal),

  status: (signal?: AbortSignal) => get<StatusReport>('/v1/status', signal),

  agents: (
    q: {capability?: string; rank?: string; minScore?: number; limit?: number} = {},
    signal?: AbortSignal,
  ) => get<{agents: AgentSummary[]}>(`/v1/agents${query(q)}`, signal).then((r) => r.agents),

  agent: (agentId: number, signal?: AbortSignal) => get<AgentSummary>(`/v1/agents/${agentId}`, signal),

  /** Who paid for an agent's record, read from the program's events. */
  trust: (agentId: number, signal?: AbortSignal) => get<TrustReport>(`/v1/agents/${agentId}/trust`, signal),

  /** Jobs, newest first; `agent` keeps those where it is the client or the worker. */
  jobs: (q: {agent?: number; limit?: number} = {}, signal?: AbortSignal) =>
    get<{jobs: JobSummary[]}>(`/v1/jobs${query(q)}`, signal).then((r) => r.jobs),

  /** One job and its on-chain history. */
  job: (jobId: string, signal?: AbortSignal) =>
    get<JobDetail>(`/v1/jobs/${encodeURIComponent(jobId)}`, signal),

  /** The program's events, newest first. */
  activity: (q: {agent?: number; limit?: number} = {}, signal?: AbortSignal) =>
    get<{events: ActivityItem[]; complete: boolean}>(`/v1/activity${query(q)}`, signal),
};

/** `20000` → `0.02`, without floats: the string is the source of truth. */
export function formatUnits(base: string, decimals = 6): string {
  const negative = base.startsWith('-');
  const digits = (negative ? base.slice(1) : base).padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals) || '0';
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
