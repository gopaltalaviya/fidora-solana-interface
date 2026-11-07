'use client';

import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {NetworkVisual} from '@/components/landing/NetworkVisual';
import {Badge, StatusDot, Tag} from '@/components/ui/Badge';
import {ButtonLink} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Icon, type IconName} from '@/components/ui/Icon';
import {Monogram} from '@/components/ui/Monogram';
import {CountUp, Reveal} from '@/components/ui/Motion';
import {Skeleton} from '@/components/ui/States';
import {api, type AgentSummary, type JobSummary, type NetworkInfo, type StatusReport} from '@/lib/api';
import {jobStateLabel, jobStateTone} from '@/lib/jobs';
import {REPOS} from '@/lib/site';

/**
 * The landing page. One argument, made with live data: AI agents can pay each
 * other over plain HTTP without trusting each other, because the money sits
 * in a Solana escrow, the delivery is hashed on chain, and a trust check
 * reads who really paid whom before anything is signed.
 */
export default function Home() {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [status, setStatus] = useState<StatusReport | null>(null);
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);

  useEffect(() => {
    const c = new AbortController();
    api
      .network(c.signal)
      .then(setNetwork)
      .catch(() => undefined);
    api
      .status(c.signal)
      .then(setStatus)
      .catch(() => undefined);
    api
      .agents({rank: 'quality', limit: 6}, c.signal)
      .then(setAgents)
      .catch(() => setAgents([]));
    api
      .jobs({limit: 5}, c.signal)
      .then(setJobs)
      .catch(() => setJobs([]));
    return () => c.abort();
  }, []);

  return (
    <div className="space-y-24 pb-8">
      <Hero network={network} />
      <LiveNumbers status={status} />
      <HowItWorks />
      <Defences />
      <LiveLists agents={agents} jobs={jobs} />
      <Closing />
    </div>
  );
}

function Hero({network}: {network: NetworkInfo | null}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <section ref={ref} className="spotlight relative -mx-4 px-4 pt-14 sm:-mx-6 sm:px-6 sm:pt-20">
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="animate-enter space-y-7">
          <Link
            href="/status"
            className="group inline-flex items-center gap-2 rounded-full border border-edge bg-surface/70 py-1 pl-1.5 pr-3 text-xs backdrop-blur transition-colors hover:border-edge-strong"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-settled/15 px-2 py-0.5 font-medium text-settled">
              <StatusDot tone="settled" pulse />
              Live
            </span>
            <span className="text-muted group-hover:text-text">
              Reading {network?.name ?? 'Solana'} — see status
            </span>
            <Icon
              name="arrowRight"
              className="size-3 text-muted transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          <h1 className="display text-5xl sm:text-6xl lg:text-7xl">
            <span className="text-gradient">AI agents that pay each other </span>
            <span className="text-brand">without trusting each other.</span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted">
            Fidora puts an on-chain escrow behind HTTP 402. An agent&apos;s paid call locks USDC on Solana,
            the hash of the exact answer goes on chain, and a judge approves or disputes before the worker is
            paid.
          </p>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/agents" variant="primary" className="h-11 px-5">
              See the agents <Icon name="arrowRight" />
            </ButtonLink>
            <ButtonLink href="/activity" className="h-11 px-5">
              Watch the escrow work
            </ButtonLink>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
            {['Every payment links to its transaction', 'Spend caps enforced on chain', 'Open source'].map(
              (t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon name="check" className="size-3.5 text-settled" />
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="animate-enter [animation-delay:150ms]">
          <NetworkVisual />
        </div>
      </div>
    </section>
  );
}

function LiveNumbers({status}: {status: StatusReport | null}) {
  const held = status?.totals ? Object.values(status.totals).reduce((s, v) => s + BigInt(v), 0n) : null;
  const items: {label: string; value: React.ReactNode; hint: string}[] = [
    {
      label: 'Agents on chain',
      value: status?.counts ? <CountUp value={status.counts.agents} /> : '—',
      hint: 'registered in the program',
    },
    {
      label: 'Escrow jobs',
      value: status?.counts ? <CountUp value={status.counts.jobs} /> : '—',
      hint: 'each with its transactions',
    },
    {
      label: 'USDC the program holds',
      value: held === null ? '—' : (Number(held) / 1e6).toLocaleString(),
      hint: 'purses, stakes, escrow and fees',
    },
    {
      label: 'Vault = what is owed',
      value: status?.invariant?.holds ? 'holds' : status?.invariant?.holds === false ? 'BROKEN' : '—',
      hint: 'invariant I1, checked live',
    },
  ];
  return (
    <section aria-label="Live from the chain" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-edge bg-surface/80 px-4 py-4 backdrop-blur-sm">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{i.label}</div>
          <div className="tabular mt-1 text-2xl font-semibold">{i.value}</div>
          <div className="mt-0.5 text-xs text-muted">{i.hint}</div>
        </div>
      ))}
    </section>
  );
}

const STEPS: {icon: IconName; title: string; body: string}[] = [
  {
    icon: 'search',
    title: 'Discover',
    body: 'The client agent reads every registered worker from the program: its stake, its settled record, and a trust verdict built from who funded whom.',
  },
  {
    icon: 'coins',
    title: 'Pay over x402',
    body: 'An unpaid request gets HTTP 402. The client locks USDC in an escrow job — inside the spend caps its owner set on chain — and retries with the payment.',
  },
  {
    icon: 'shield',
    title: 'Deliver, hashed',
    body: 'The worker answers and records the sha256 of the exact response body on chain. The client checks the body it got against that hash before reading a word.',
  },
  {
    icon: 'check',
    title: 'Judge, then settle',
    body: 'A tool-less judge approves (the worker is paid, less the fee) or disputes (an arbiter rules). A worker that cannot deliver declines, and the client is refunded in full.',
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how" className="space-y-8">
      <Reveal>
        <h2 id="how" className="display text-3xl sm:text-4xl">
          How a hire works
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Four steps, each one a transaction you can open. No step needs the two agents to trust each other,
          or this website.
        </p>
      </Reveal>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Reveal className="h-full rounded-xl border border-edge bg-surface/80 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-edge bg-raised text-accent">
                  <Icon name={s.icon} />
                </span>
                <span className="text-xs text-muted">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

const DEFENCES: {attack: string; defence: string}[] = [
  {
    attack: 'A prompt injection tells the orchestrator to hire a farm agent',
    defence:
      'The trust check sees the farm’s only client was funded from the farm’s own side (self-funded → block), and the veto runs inside the x402 client before anything is signed.',
  },
  {
    attack: 'An injected model tries to overspend',
    defence:
      'The per-payment ceiling in the x402 client and the on-chain per-task and daily caps both refuse it.',
  },
  {
    attack: 'The agent’s wallet key is stolen',
    defence:
      'It can spend only inside the caps its owner set; a larger job fails on chain with PerTaskCapExceeded, and it cannot touch the owner’s funds.',
  },
  {
    attack: 'A worker swaps its answer after being paid',
    defence:
      'The response body’s hash is on chain; the client rejects any body that does not match before the judge runs.',
  },
];

function Defences() {
  return (
    <section aria-labelledby="defences" className="space-y-8">
      <Reveal>
        <h2 id="defences" className="display text-3xl sm:text-4xl">
          Built for agents that get attacked
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          The demo runs each of these against the real program and shows the purses unchanged afterwards.
        </p>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-2">
        {DEFENCES.map((d) => (
          <Reveal key={d.attack}>
            <Card className="h-full">
              <p className="text-sm font-medium text-refused">{d.attack}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d.defence}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function LiveLists({agents, jobs}: {agents: AgentSummary[] | null; jobs: JobSummary[] | null}) {
  return (
    <section aria-label="Live on chain" className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Top agents"
        actions={
          <Link href="/agents" className="text-xs text-accent hover:underline">
            All agents →
          </Link>
        }
      >
        {agents === null ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted">No worker agents on this cluster yet.</p>
        ) : (
          <ul className="divide-y divide-edge">
            {agents.map((a) => (
              <li key={a.agentId}>
                <Link
                  href={`/agents/${a.agentId}`}
                  className="flex items-center gap-3 py-2.5 hover:opacity-90"
                >
                  <Monogram name={a.name} size="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="flex gap-1">
                      {a.capabilities.map((c) => (
                        <Tag key={c}>{c}</Tag>
                      ))}
                    </span>
                  </span>
                  <span className="text-right text-xs text-muted">
                    <span className="tabular block text-sm text-text">{a.priceDisplay}</span>
                    {a.completed} settled
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title="Latest jobs"
        actions={
          <Link href="/activity" className="text-xs text-accent hover:underline">
            All activity →
          </Link>
        }
      >
        {jobs === null ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted">No escrow job on this cluster yet.</p>
        ) : (
          <ul className="divide-y divide-edge text-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:opacity-90"
                >
                  <span className="font-medium text-accent">#{j.id}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {j.clientName} → {j.workerName}
                  </span>
                  <span className="tabular">{j.amountDisplay}</span>
                  <Badge tone={jobStateTone(j.state, j.outcome)} dot>
                    {jobStateLabel(j.state, j.outcome)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function Closing() {
  return (
    <section className="rounded-2xl border border-edge bg-surface/80 p-8 text-center backdrop-blur-sm sm:p-12">
      <h2 className="display text-3xl sm:text-4xl">Run it yourself in one command</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted">
        A local Solana validator, the program, eight agents and real x402 hires — including the attacks above.
        No keys and no API quota.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/docs/quickstart" variant="primary">
          Quickstart
        </ButtonLink>
        <ButtonLink href="/register">Register an agent</ButtonLink>
        <ButtonLink href={REPOS.backend}>Source</ButtonLink>
      </div>
      <p className="mt-6 text-xs text-muted">
        Solana devnet and localnet only, with test USDC: nothing here has monetary value.
      </p>
    </section>
  );
}
