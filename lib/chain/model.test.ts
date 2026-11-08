import {describe, expect, it} from 'vitest';
import type {AgentView, ChainEvent, ConfigView} from './fidora';
import {
  agentSummary,
  describeEvent,
  formatUsdc,
  invariantI1,
  parseCard,
  rankAgents,
  reputationScore,
  trustAll,
  verdictOf,
} from './model';

const agent = (
  id: string,
  owner: string,
  wallet: string | null,
  over: Partial<AgentView> = {},
): AgentView => ({
  id,
  address: `pda${id}`,
  owner,
  wallet,
  cardUri: `http://127.0.0.1:9/agent.json#n=Agent${id}&c=market-research&p=20000`,
  frozen: false,
  registeredAt: 0,
  purse: {balance: '0', perTaskCap: '100000', dailyCap: '1000000'},
  stake: {available: '11000000', locked: '0', pending: '0'},
  workerRecord: {completed: 0, failed: 0, disputesLost: 0, unresolved: 0, reviews: 0, reviewScoreSum: 0},
  clientRecord: {paid: 0, disputesRejected: 0, disputesUpheld: 0, silent: 0},
  ...over,
});

const ev = (name: string, data: Record<string, string>, slot: number): ChainEvent => ({
  name,
  data,
  signature: `sig${slot}`,
  slot,
  blockTime: null,
});

const ctx = {
  network: 'solana:test',
  minStake: '10000000',
  explorerAddress: (a: string) => `https://explorer.solana.com/address/${a}`,
};

describe('parseCard: what the chain alone says about an agent', () => {
  it('reads name, capability and price from the card URI fragment', () => {
    expect(
      parseCard('http://127.0.0.1:5555/agent.json#n=MarketResearch&c=market-research&p=20000', '1'),
    ).toEqual({
      name: 'MarketResearch',
      capability: 'market-research',
      price: '20000',
    });
  });

  it('names a data: card by its text, with no paid skill', () => {
    expect(parseCard('data:,orchestrator', '4')).toEqual({
      name: 'orchestrator',
      capability: null,
      price: null,
    });
  });

  it('refuses hostile or malformed fields rather than showing them', () => {
    const c = parseCard('https://x.example/a#n=ok&c=<script>&p=1e9', '2');
    expect(c.capability).toBeNull();
    expect(c.price).toBeNull();
    expect(parseCard('javascript:alert(1)', '3').name).toBe('Agent #3');
    expect(parseCard('not a url', '5').name).toBe('Agent #5');
  });
});

describe('formatUsdc', () => {
  it('is exact on strings, with no float rounding', () => {
    expect(formatUsdc('20000')).toBe('0.02');
    expect(formatUsdc('69000000')).toBe('69');
    expect(formatUsdc('123456789012345678901')).toBe('123456789012345.678901');
  });
});

describe('agentSummary: hireable by the protocol’s own rule', () => {
  it('is active with a wallet, a paid skill and the minimum stake free', () => {
    expect(agentSummary(agent('1', 'O1', 'W1'), ctx).active).toBe(true);
  });

  it('is not active without a wallet, when frozen, or when stake is locked below the minimum', () => {
    expect(agentSummary(agent('1', 'O1', null), ctx).active).toBe(false);
    expect(agentSummary(agent('1', 'O1', 'W1', {frozen: true}), ctx).active).toBe(false);
    expect(
      agentSummary(
        agent('1', 'O1', 'W1', {stake: {available: '11000000', locked: '2000000', pending: '0'}}),
        ctx,
      ).active,
    ).toBe(false);
  });

  it('counts a lost dispute as a failure and scores from the escrow’s reviews (50 before any)', () => {
    const a = agentSummary(
      agent('1', 'O1', 'W1', {
        workerRecord: {
          completed: 3,
          failed: 1,
          disputesLost: 1,
          unresolved: 0,
          reviews: 2,
          reviewScoreSum: 150,
        },
      }),
      ctx,
    );
    expect(a.failed).toBe(2);
    expect(a.successRate).toBeCloseTo(0.6);
    expect(a.score).toBe(75);
    expect(agentSummary(agent('2', 'O2', 'W2'), ctx).score).toBe(50);
  });
});

describe('rankAgents', () => {
  it('lists workers only, active first, and filters by capability', () => {
    const rows = [
      agentSummary(agent('1', 'O1', 'W1'), ctx),
      agentSummary(agent('4', 'O4', 'W4', {cardUri: 'data:,orchestrator'}), ctx),
      agentSummary(agent('5', 'O5', null), ctx),
    ];
    expect(rankAgents(rows, {}).map((a) => a.agentId)).toEqual([1, 5]);
    expect(rankAgents(rows, {capability: 'trade-analysis'})).toEqual([]);
  });
});

describe('verdictOf (the backend’s rules, unchanged)', () => {
  it('blocks a self-funded record before anything else', () => {
    expect(
      verdictOf({settled: 5, failed: 0, clientOwners: 5, topOwnerSettled: 1, selfFunded: 1}).verdict,
    ).toBe('self-funded');
  });
  it('calls fewer than three finished jobs new, and a high failure rate failing', () => {
    expect(
      verdictOf({settled: 2, failed: 0, clientOwners: 2, topOwnerSettled: 1, selfFunded: 0}).verdict,
    ).toBe('new');
    expect(
      verdictOf({settled: 2, failed: 2, clientOwners: 2, topOwnerSettled: 1, selfFunded: 0}).verdict,
    ).toBe('failing');
  });
  it('flags a record one owner wrote as concentrated, and clears a broad one', () => {
    expect(
      verdictOf({settled: 4, failed: 0, clientOwners: 1, topOwnerSettled: 4, selfFunded: 0}).verdict,
    ).toBe('concentrated');
    expect(
      verdictOf({settled: 3, failed: 0, clientOwners: 3, topOwnerSettled: 1, selfFunded: 0}).verdict,
    ).toBe('trusted');
  });
});

describe('trustAll: the farm the demo builds', () => {
  // Agent 6 (the farm, owner F) is hired by agent 7, whose purse F's owner funded first.
  const agents = [agent('6', 'F', 'W6'), agent('7', 'P', 'W7', {cardUri: 'data:,happy-client'})];
  const events = [
    ev('Funded', {agentId: '7', from: 'F', amount: '1000000', kind: '0'}, 10),
    ev('JobCreated', {jobId: '5', client: '7', worker: '6', amount: '20000'}, 11),
    ev('JobSettled', {jobId: '5', worker: '6', paid: '19800', fee: '200', outcome: 'success'}, 12),
  ];

  it('reads the farm as self-funded → block', () => {
    const t = trustAll(agents, events, {network: 'n', complete: true, maxTransactions: 2000, slot: 99}).get(
      '6',
    )!;
    expect(t.verdict).toBe('self-funded');
    expect(t.action).toBe('block');
    expect(t.metrics).toMatchObject({settled: 1, selfFunded: 1, volume: '20000', clientOwners: 1});
  });

  it('does not count funding that came after the payment', () => {
    const late = [
      events[1]!,
      events[2]!,
      ev('Funded', {agentId: '7', from: 'F', amount: '1', kind: '0'}, 13),
    ];
    expect(
      trustAll(agents, late, {network: 'n', complete: true, maxTransactions: 2000, slot: 99}).get('6')!
        .metrics.selfFunded,
    ).toBe(0);
  });

  it('ignores stake deposits (kind 1) as funding', () => {
    const stake = [
      ev('Funded', {agentId: '7', from: 'F', amount: '1', kind: '1'}, 10),
      events[1]!,
      events[2]!,
    ];
    expect(
      trustAll(agents, stake, {network: 'n', complete: true, maxTransactions: 2000, slot: 99}).get('6')!
        .metrics.selfFunded,
    ).toBe(0);
  });

  it('blocks everyone when the scan was partial, whatever the numbers say', () => {
    const t = trustAll(agents, [], {network: 'n', complete: false, maxTransactions: 2000, slot: 99}).get(
      '7',
    )!;
    expect(t.action).toBe('block');
    expect(t.reasons[0]).toMatch(/not fully read yet.*newest 2000 transactions.*no agent is cleared/);
  });
});

describe('reputationScore (Pactora’s formula, integer arithmetic)', () => {
  it('starts at 50 and moves with confidence', () => {
    expect(reputationScore(0, 0)).toBe(50);
    expect(reputationScore(2, 0)).toBe(52);
    expect(reputationScore(100, 0)).toBe(99);
    expect(reputationScore(0, 30)).toBe(3);
  });
});

describe('invariantI1', () => {
  const cfg = {
    totals: {locked: '1', disputeBonds: '2', balances: '3', stakes: '4', feesOwed: '5'},
  } as ConfigView;
  it('holds only when the vault equals the sum of what is owed', () => {
    expect(invariantI1(cfg, '15')).toEqual({holds: true, owed: '15', vault: '15'});
    expect(invariantI1(cfg, '14').holds).toBe(false);
    expect(invariantI1(cfg, null).holds).toBeNull();
  });
});

describe('describeEvent', () => {
  it('says who hired whom for how much', () => {
    const names = (id: string) => ({'4': 'orchestrator', '1': 'MarketResearch'})[id] ?? `Agent #${id}`;
    expect(
      describeEvent(ev('JobCreated', {jobId: '1', client: '4', worker: '1', amount: '20000'}, 1), names),
    ).toBe('Job #1: orchestrator locked 0.02 USDC in escrow to hire MarketResearch');
  });
});
