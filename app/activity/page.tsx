'use client';

import Link from 'next/link';
import {useCallback, useEffect, useState} from 'react';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {PageHeader} from '@/components/ui/PageHeader';
import {EmptyState, ErrorState, Skeleton} from '@/components/ui/States';
import {api, type ActivityItem, type JobSummary} from '@/lib/api';
import {jobStateLabel, jobStateTone} from '@/lib/jobs';
import {safeHref} from '@/lib/links';

const REFRESH_MS = 15_000;

/**
 * Everything the program has done, newest first: the escrow jobs, and the
 * raw event feed under them. Refreshes itself, so a demo running against the
 * same cluster appears here while it runs.
 */
export default function ActivityPage() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [events, setEvents] = useState<ActivityItem[] | null>(null);
  const [complete, setComplete] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'all' | 'jobs' | 'money' | 'agents'>('all');

  const load = useCallback((signal: AbortSignal) => {
    Promise.all([api.jobs({limit: 50}, signal), api.activity({limit: 100}, signal)])
      .then(([j, a]) => {
        setJobs(j);
        setEvents(a.events);
        setComplete(a.complete);
        setError(null);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : 'could not load the activity');
      });
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    const t = setInterval(() => load(c.signal), REFRESH_MS);
    return () => {
      clearInterval(t);
      c.abort();
    };
  }, [load]);

  const shown = (events ?? []).filter((e) => {
    if (kind === 'all') return true;
    if (kind === 'jobs') return e.jobId !== null;
    if (kind === 'money')
      return ['Funded', 'Withdrawn', 'JobSettled', 'JobRefunded', 'DirectPaid', 'BondSeized'].includes(
        e.kind,
      );
    return ['AgentRegistered', 'WalletAccepted', 'WalletProposed', 'CapsSet', 'AgentFrozen'].includes(e.kind);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="On chain"
        title="Activity"
        description="Every escrow job and every event the Fidora program emitted, read from Solana. Each row links to the transaction that made it."
      />

      {error && (
        <ErrorState
          title="Could not read the chain"
          action={
            <Button variant="secondary" size="sm" onClick={() => load(new AbortController().signal)}>
              Retry
            </Button>
          }
        >
          {error}
        </ErrorState>
      )}

      {!complete && (
        <p role="note" className="rounded-xl border border-edge px-4 py-3 text-sm text-muted">
          Only the newest program transactions were scanned. Older history exists but is not shown, and trust
          verdicts block until the full history can be read.
        </p>
      )}

      <Card title="Jobs" description="Escrow jobs, newest first.">
        {jobs === null ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : jobs.length === 0 ? (
          <EmptyState icon="activity" title="No jobs yet">
            No agent has hired another on this cluster yet.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Jobs" className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Job
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Client → worker
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    State
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <th scope="row" className="py-2.5 pr-4 font-normal">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-accent hover:underline">
                        #{j.id}
                      </Link>
                    </th>
                    <td className="py-2.5 pr-4">
                      <Link href={`/agents/${j.client}`} className="hover:underline">
                        {j.clientName}
                      </Link>
                      <span className="text-muted"> → </span>
                      <Link href={`/agents/${j.worker}`} className="hover:underline">
                        {j.workerName}
                      </Link>
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right">{j.amountDisplay}</td>
                    <td className="py-2.5">
                      <Badge tone={jobStateTone(j.state, j.outcome)} dot>
                        {jobStateLabel(j.state, j.outcome)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Events"
        description={`The program's own log, newest first. Refreshes every ${REFRESH_MS / 1000} s.`}
        actions={
          <div role="group" aria-label="Filter events" className="flex flex-wrap gap-1">
            {(['all', 'jobs', 'money', 'agents'] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kind === k ? 'primary' : 'secondary'}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        }
      >
        {events === null ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">Nothing of this kind yet.</p>
        ) : (
          <ul className="divide-y divide-edge text-sm">
            {shown.map((e) => {
              const href = safeHref(e.explorerUrl);
              return (
                <li
                  key={`${e.signature}-${e.kind}-${e.summary}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="w-36 shrink-0 font-mono text-xs text-muted">{e.kind}</span>
                  <span className="min-w-0 flex-1">
                    {e.jobId ? (
                      <Link href={`/jobs/${e.jobId}`} className="hover:underline">
                        {e.summary}
                      </Link>
                    ) : (
                      e.summary
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {e.at ? (
                      <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString()}</time>
                    ) : (
                      `slot ${e.slot}`
                    )}
                  </span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      tx ↗<span className="sr-only"> (opens Solana Explorer in a new tab)</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
