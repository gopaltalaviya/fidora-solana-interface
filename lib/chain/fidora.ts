/**
 * The interface's only view of Fidora: the program's accounts and events,
 * read straight from a Solana RPC. Server-only (route handlers under
 * app/api/v1): the browser never talks to the RPC, so a public rate limit is
 * hit once per cache window, not once per visitor.
 *
 * Ported from fidora-solana-backend src/chain/fidora.ts (decoding, PDAs) and
 * src/agents/trust.ts (event scan), minus everything that signs or reads a
 * file. Localnet and devnet only: a mainnet or testnet genesis is refused.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Anchor decodes accounts from the JSON IDL, untyped; every field is converted to a typed view below. */
import 'server-only';
import {AnchorProvider, BN, BorshCoder, EventParser, Program} from '@anchor-lang/core';
import {Connection, PublicKey} from '@solana/web3.js';
import IDL from './idl.json';
import {makePatientFetch} from './patient-fetch';

export const PROGRAM_ID = new PublicKey(IDL.address);
const coder = new BorshCoder(IDL as never);

export type ClusterName = 'localnet' | 'devnet';
export const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const REFUSED: Record<string, string> = {
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'mainnet-beta',
  'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': 'testnet',
};
const DEFAULT_RPC: Record<ClusterName, string> = {
  localnet: 'http://127.0.0.1:8899',
  devnet: 'https://api.devnet.solana.com',
};

export interface ClusterInfo {
  name: ClusterName;
  rpcUrl: string;
  connection: Connection;
  /** CAIP-2 from the node's genesis hash, never assumed. */
  network: string;
  /** Events before this slot belong to an older deployment and are ignored. */
  startSlot: number;
  explorerTx(sig: string): string;
  explorerAddress(addr: string): string;
}

export function clusterName(env = process.env): ClusterName {
  const n = env['FIDORA_CLUSTER'] ?? 'devnet';
  if (n !== 'localnet' && n !== 'devnet')
    throw new Error(`FIDORA_CLUSTER must be localnet or devnet, not ${n}`);
  return n;
}

let cached: Promise<ClusterInfo> | null = null;

/** The cluster this deployment reads, checked once per server process. */
export function cluster(env = process.env): Promise<ClusterInfo> {
  cached ??= openCluster(env).catch((e) => {
    cached = null; // a node that was down at boot may come up
    throw e;
  });
  return cached;
}

async function openCluster(env: NodeJS.ProcessEnv): Promise<ClusterInfo> {
  const name = clusterName(env);
  const rpcUrl = env['FIDORA_RPC_URL'] || DEFAULT_RPC[name];
  if (/mainnet/i.test(rpcUrl)) throw new Error('refusing a mainnet RPC');
  const connection =
    name === 'localnet'
      ? new Connection(rpcUrl, 'confirmed')
      : new Connection(rpcUrl, {
          commitment: 'confirmed',
          // Bounded: a page request must answer inside a serverless time limit.
          fetch: makePatientFetch({maxWaitMs: 8_000}),
          disableRetryOnRateLimit: true,
        });
  const network = `solana:${(await connection.getGenesisHash()).slice(0, 32)}`;
  if (REFUSED[network])
    throw new Error(`refusing Solana ${REFUSED[network]}: Fidora runs on localnet and devnet only`);
  if (name === 'devnet' && network !== SOLANA_DEVNET) throw new Error('FIDORA_RPC_URL is not devnet');
  if (name === 'localnet' && network === SOLANA_DEVNET)
    throw new Error('FIDORA_RPC_URL is devnet, not a local validator');
  const q = name === 'devnet' ? '?cluster=devnet' : `?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;
  return {
    name,
    rpcUrl,
    connection,
    network,
    startSlot: Number(env['FIDORA_START_SLOT'] ?? 0),
    explorerTx: (sig) => `https://explorer.solana.com/tx/${sig}${q}`,
    explorerAddress: (a) => `https://explorer.solana.com/address/${a}${q}`,
  };
}

const u64le = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};
export const pda = {
  config: () => PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID)[0],
  vault: () => PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0],
  agent: (id: number | bigint) =>
    PublicKey.findProgramAddressSync([Buffer.from('agent'), u64le(id)], PROGRAM_ID)[0],
  job: (id: number | bigint) =>
    PublicKey.findProgramAddressSync([Buffer.from('job'), u64le(id)], PROGRAM_ID)[0],
};

function program(c: ClusterInfo) {
  const readOnly = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error('read-only');
    },
    signAllTransactions: async () => {
      throw new Error('read-only');
    },
  };
  return new Program(
    IDL as never,
    new AnchorProvider(c.connection, readOnly as never, {commitment: 'confirmed'}),
  );
}

// ── plain shapes (bigints as strings stay exact through JSON) ────────────

const s = (v: unknown) => (v == null ? '0' : String((v as {toString(): string}).toString()));
const b58 = (v: unknown) => (v ? (v as PublicKey).toBase58() : null);
export {b58 as toBase58OrNull};
const variant = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v)[0]! : null);

export interface Params {
  protocolFeeBps: number;
  minFee: string;
  minJobAmount: string;
  maxJobAmount: string;
  fastPathMax: string;
  reviewWindow: number;
  maxAcceptWindow: number;
  maxWorkWindow: number;
  disputeTimeout: number;
  bondBps: number;
  minBond: string;
  disputeBondBps: number;
  minDisputeBond: string;
  minStake: string;
  withdrawDelay: number;
  defaultPerTaskCap: string;
  defaultDailyCap: string;
}

export interface ConfigView {
  owner: string;
  arbiter: string;
  mint: string;
  paused: boolean;
  params: Params;
  nextAgentId: number;
  nextJobId: number;
  totals: {locked: string; disputeBonds: string; balances: string; stakes: string; feesOwed: string};
}

export interface AgentView {
  id: string;
  address: string;
  owner: string;
  wallet: string | null;
  cardUri: string;
  frozen: boolean;
  registeredAt: number;
  purse: {balance: string; perTaskCap: string; dailyCap: string};
  stake: {available: string; locked: string; pending: string};
  workerRecord: {
    completed: number;
    failed: number;
    disputesLost: number;
    unresolved: number;
    reviews: number;
    reviewScoreSum: number;
  };
  clientRecord: {paid: number; disputesRejected: number; disputesUpheld: number; silent: number};
}

export type JobState = 'created' | 'accepted' | 'submitted' | 'disputed' | 'settled' | 'refunded';

export interface JobView {
  id: string;
  address: string;
  client: string;
  worker: string;
  amount: string;
  fee: string;
  state: JobState;
  outcome: string | null;
  acceptDeadline: number;
  workDeadline: number;
  reviewDeadline: number;
  disputeDeadline: number;
  specHash: string;
  resultHash: string | null;
  workerBond: string;
  disputeBond: string;
  createdAt: number;
}

const hex = (v: unknown) => (v ? Buffer.from(v as number[]).toString('hex') : null);

function toConfig(r: Record<string, any>): ConfigView {
  const p = r['params'] as Record<string, unknown>;
  const n = (k: string) => Number(s(p[k]));
  return {
    owner: b58(r['owner'])!,
    arbiter: b58(r['arbiter'])!,
    mint: b58(r['mint'])!,
    paused: Boolean(r['paused']),
    params: {
      protocolFeeBps: n('protocolFeeBps'),
      minFee: s(p['minFee']),
      minJobAmount: s(p['minJobAmount']),
      maxJobAmount: s(p['maxJobAmount']),
      fastPathMax: s(p['fastPathMax']),
      reviewWindow: n('reviewWindow'),
      maxAcceptWindow: n('maxAcceptWindow'),
      maxWorkWindow: n('maxWorkWindow'),
      disputeTimeout: n('disputeTimeout'),
      bondBps: n('bondBps'),
      minBond: s(p['minBond']),
      disputeBondBps: n('disputeBondBps'),
      minDisputeBond: s(p['minDisputeBond']),
      minStake: s(p['minStake']),
      withdrawDelay: n('withdrawDelay'),
      defaultPerTaskCap: s(p['defaultPerTaskCap']),
      defaultDailyCap: s(p['defaultDailyCap']),
    },
    nextAgentId: Number(s(r['nextAgentId'])),
    nextJobId: Number(s(r['nextJobId'])),
    totals: {
      locked: s(r['totals'].locked),
      disputeBonds: s(r['totals'].disputeBonds),
      balances: s(r['totals'].balances),
      stakes: s(r['totals'].stakes),
      feesOwed: s(r['totals'].feesOwed),
    },
  };
}

export function toAgentView(r: Record<string, any>, address: string): AgentView {
  const w = r['workerRecord'];
  const c = r['clientRecord'];
  return {
    id: s(r['id']),
    address,
    owner: b58(r['owner'])!,
    wallet: b58(r['wallet']),
    cardUri: String(r['cardUri'] ?? ''),
    frozen: Boolean(r['frozen']),
    registeredAt: Number(s(r['registeredAt'])),
    purse: {
      balance: s(r['purse'].balance),
      perTaskCap: s(r['purse'].perTaskCap),
      dailyCap: s(r['purse'].dailyCap),
    },
    stake: {available: s(r['stake'].available), locked: s(r['stake'].locked), pending: s(r['stake'].pending)},
    workerRecord: {
      completed: Number(s(w.completed)),
      failed: Number(s(w.failed)),
      disputesLost: Number(s(w.disputesLost)),
      unresolved: Number(s(w.unresolved)),
      reviews: Number(s(w.reviews)),
      reviewScoreSum: Number(s(w.reviewScoreSum)),
    },
    clientRecord: {
      paid: Number(s(c.paid)),
      disputesRejected: Number(s(c.disputesRejected)),
      disputesUpheld: Number(s(c.disputesUpheld)),
      silent: Number(s(c.silent)),
    },
  };
}

export function toJobView(r: Record<string, any>, address: string): JobView {
  return {
    id: s(r['id']),
    address,
    client: s(r['client']),
    worker: s(r['worker']),
    amount: s(r['amount']),
    fee: s(r['fee']),
    state: variant(r['state']) as JobState,
    outcome: variant(r['outcome']),
    acceptDeadline: Number(s(r['acceptDeadline'])),
    workDeadline: Number(s(r['workDeadline'])),
    reviewDeadline: Number(s(r['reviewDeadline'])),
    disputeDeadline: Number(s(r['disputeDeadline'])),
    specHash: hex(r['specHash'])!,
    resultHash: hex(r['resultHash']),
    workerBond: s(r['workerBond']),
    disputeBond: s(r['disputeBond']),
    createdAt: Number(s(r['createdAt'])),
  };
}

// ── reads, cached per server process ─────────────────────────────────────

const TTL_MS = Number(process.env['FIDORA_CACHE_MS'] ?? 15_000);
const memo = new Map<string, {at: number; value: Promise<unknown>}>();

/** One RPC round per key per TTL, however many visitors ask. A failed read is not kept. */
export function cachedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = read().catch((e) => {
    memo.delete(key);
    throw e;
  });
  memo.set(key, {at: Date.now(), value});
  return value;
}

export function readConfig(): Promise<ConfigView | null> {
  return cachedRead('config', async () => {
    const c = await cluster();
    const raw = await (program(c).account as any).config.fetchNullable(pda.config());
    return raw ? toConfig(raw) : null;
  });
}

export function readAgents(): Promise<AgentView[]> {
  return cachedRead('agents', async () => {
    const c = await cluster();
    const rows = await (program(c).account as any).agent.all();
    return (rows as {publicKey: PublicKey; account: Record<string, any>}[])
      .map((r) => toAgentView(r.account, r.publicKey.toBase58()))
      .sort((a, b) => Number(a.id) - Number(b.id));
  });
}

export function readJobs(): Promise<JobView[]> {
  return cachedRead('jobs', async () => {
    const c = await cluster();
    const rows = await (program(c).account as any).job.all();
    return (rows as {publicKey: PublicKey; account: Record<string, any>}[])
      .map((r) => toJobView(r.account, r.publicKey.toBase58()))
      .sort((a, b) => Number(a.id) - Number(b.id));
  });
}

/** The vault's token balance in base units (it must equal the sum of Config.totals: invariant I1). */
export function readVaultBalance(): Promise<string | null> {
  return cachedRead('vault', async () => {
    const c = await cluster();
    try {
      return (await c.connection.getTokenAccountBalance(pda.vault())).value.amount;
    } catch {
      return null;
    }
  });
}

export function readSlot(): Promise<number> {
  return cachedRead('slot', async () => (await cluster()).connection.getSlot('confirmed'));
}

// ── events ───────────────────────────────────────────────────────────────

export interface ChainEvent {
  name: string;
  data: Record<string, string>;
  signature: string;
  slot: number;
  blockTime: number | null;
}

/** How many program transactions one scan examines (newest kept). */
export const MAX_TRANSACTIONS = Number(process.env['FIDORA_MAX_TRANSACTIONS'] ?? 2_000);

const camel = (k: string) => k.replace(/_([a-z])/g, (_m, ch: string) => ch.toUpperCase());

/** Event fields as strings: u64 exact, pubkeys base58, enums by variant name, hashes hex. */
function flat(v: unknown): string {
  if (v == null) return '';
  if (typeof (v as PublicKey).toBase58 === 'function') return (v as PublicKey).toBase58();
  if (Array.isArray(v)) return Buffer.from(v as number[]).toString('hex');
  if (BN.isBN(v)) return String(v);
  if (typeof v === 'object') return variant(v) ?? '';
  return String(v);
}

/**
 * How long one page request may spend reading transactions, on a public
 * cluster. The public devnet RPC lets ~10 getTransaction calls through and
 * then 429s (measured 2026-11-08), and a serverless request has a time
 * limit: past this budget the scan answers with what it has, marked
 * incomplete, and the next request carries on from there (`parsed`).
 */
export const SCAN_BUDGET_MS = Number(process.env['FIDORA_SCAN_BUDGET_MS'] ?? 20_000);

/** Parsed events per transaction signature. A confirmed transaction never changes, so each is read once per process. */
const parsed = new Map<string, Omit<ChainEvent, 'signature' | 'slot' | 'blockTime'>[]>();

/**
 * Every Fidora event since the start slot, oldest first. `complete` is false
 * when the transaction bound or the time budget was hit first: a partial
 * history must never be read as a clean record (the trust verdict blocks on it).
 */
export function readEvents(): Promise<{events: ChainEvent[]; complete: boolean}> {
  return cachedRead('events', async () => {
    const c = await cluster();
    const started = Date.now();
    const sigs: {signature: string; slot: number; blockTime: number | null}[] = [];
    let before: string | undefined;
    let complete = false;
    for (;;) {
      const page = await c.connection.getSignaturesForAddress(
        PROGRAM_ID,
        {...(before ? {before} : {}), limit: 1_000},
        'confirmed',
      );
      if (page.length === 0) {
        complete = true;
        break;
      }
      for (const x of page)
        if (!x.err && x.slot >= c.startSlot)
          sigs.push({signature: x.signature, slot: x.slot, blockTime: x.blockTime ?? null});
      before = page[page.length - 1]!.signature;
      if (page[page.length - 1]!.slot < c.startSlot || page.length < 1_000) {
        complete = true;
        break;
      }
      if (sigs.length >= MAX_TRANSACTIONS) break;
    }
    sigs.sort((a, b) => a.slot - b.slot);
    const parser = new EventParser(PROGRAM_ID, coder);
    const parse = (logs: string[]) => {
      const out: {name: string; data: Record<string, string>}[] = [];
      for (const e of parser.parseLogs(logs)) {
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.data as Record<string, unknown>)) data[camel(k)] = flat(v);
        out.push({name: e.name.replace(/^./, (m) => m.toUpperCase()), data});
      }
      return out;
    };
    const todo = sigs.filter((x) => !parsed.has(x.signature));
    const opts = {commitment: 'confirmed', maxSupportedTransactionVersion: 0} as const;
    try {
      if (c.name === 'localnet') {
        for (let i = 0; i < todo.length; i += 50) {
          const batch = todo.slice(i, i + 50);
          const txs = await c.connection.getTransactions(
            batch.map((x) => x.signature),
            opts,
          );
          // A transaction the node cannot return yet (null) is read again next time.
          txs.forEach((t, j) => t && parsed.set(batch[j]!.signature, parse(t.meta?.logMessages ?? [])));
        }
      } else {
        // The public devnet RPC refuses batched getTransaction calls; one at a time, within the budget.
        for (const x of todo) {
          if (Date.now() - started > SCAN_BUDGET_MS) break;
          const t = await c.connection.getTransaction(x.signature, opts);
          if (t) parsed.set(x.signature, parse(t.meta?.logMessages ?? []));
        }
      }
    } catch {
      // Rate-limited past what one request can wait: answer with what is read; the next request continues.
    }
    const events: ChainEvent[] = [];
    let missing = 0;
    for (const x of sigs) {
      const evs = parsed.get(x.signature);
      if (!evs) {
        missing++;
        continue;
      }
      for (const e of evs) events.push({...e, ...x});
    }
    return {events, complete: complete && missing === 0};
  });
}
