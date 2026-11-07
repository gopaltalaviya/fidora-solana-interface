'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {Badge} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {Card, Stat} from '@/components/ui/Card';
import {CopyButton} from '@/components/ui/CopyButton';
import {PageHeader} from '@/components/ui/PageHeader';
import {ErrorState, Loading, Skeleton} from '@/components/ui/States';
import {ApiError, api, formatUnits, type JobDetail} from '@/lib/api';
import {JOB_STEPS, jobStateLabel, jobStateTone} from '@/lib/jobs';
import {safeHref} from '@/lib/links';

/**
 * One escrow job, as the chain recorded it.
 *
 * Every line on this page is a fact a judge can check: the amounts and
 * hashes come from the Job account, and every step links to the transaction
 * that made it. Nothing here is the orchestrator's own account of events.
 */
export function JobView({jobId}: {jobId: string}) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<{message: string; missing: boolean} | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    setJob(null);
    setError(null);
    api
      .job(jobId, c.signal)
      .then(setJob)
      .catch((err: unknown) => {
        if (c.signal.aborted) return;
        const missing = err instanceof ApiError && err.code === 'NOT_FOUND';
        setError({
          missing,
          message: missing
            ? `There is no job #${jobId}.`
            : err instanceof Error
              ? err.message
              : 'could not load this job',
        });
      });
    return () => c.abort();
  }, [jobId, attempt]);

  const back = {href: '/activity', label: 'Activity'};

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader back={back} eyebrow="Job" title={`Job #${jobId}`} />
        <ErrorState
          title={error.missing ? 'Not found' : 'Could not load this job'}
          action={
            error.missing ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                Retry
              </Button>
            )
          }
        >
          {error.message}
        </ErrorState>
      </div>
    );
  }

  if (!job) {
    return (
      <Loading label="Loading the job">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Loading>
    );
  }

  const happened = new Map(job.events.map((e) => [e.kind, e]));
  const refund = happened.get('JobRefunded');
  const dispute = happened.get('JobDisputed');
  const explorer = safeHref(job.explorerUrl);

  return (
    <div className="space-y-8">
      <PageHeader
        back={back}
        eyebrow="Escrow job"
        title={`Job #${job.id}`}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <Link href={`/agents/${job.client}`} className="text-accent hover:underline">
                {job.clientName}
              </Link>{' '}
              hired{' '}
              <Link href={`/agents/${job.worker}`} className="text-accent hover:underline">
                {job.workerName}
              </Link>
            </span>
            <Badge tone={jobStateTone(job.state, job.outcome)} dot>
              {jobStateLabel(job.state, job.outcome)}
            </Badge>
          </div>
        }
      />

      <section aria-label="Figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Locked" value={job.amountDisplay} hint="USDC held by the program" />
        <Stat label="Protocol fee" value={`${formatUnits(job.fee)} USDC`} />
        <Stat
          label="Worker bond"
          value={`${formatUnits(job.workerBond)} USDC`}
          hint="from the worker's stake"
        />
        <Stat
          label="Dispute bond"
          value={`${formatUnits(job.disputeBond)} USDC`}
          hint="paid only if the client disputes"
        />
      </section>

      <Card title="What happened, step by step">
        <ol className="space-y-0">
          {JOB_STEPS.map((step, i) => {
            const e = happened.get(step.kind);
            const href = e ? safeHref(e.explorerUrl) : null;
            return (
              <li key={step.kind} className="relative flex gap-4 pb-6 last:pb-0">
                {i < JOB_STEPS.length - 1 && (
                  <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-edge" />
                )}
                <span
                  aria-hidden
                  className={`relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    e ? 'bg-settled/20 text-settled' : 'bg-edge text-muted'
                  }`}
                >
                  {e ? '✓' : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {step.label}
                    {!e && <span className="ml-2 text-xs font-normal text-muted">not on chain</span>}
                  </p>
                  <p className="text-sm text-muted">{e ? e.summary : step.detail}</p>
                  {e && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                      {e.at && <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>}
                      <span>slot {e.slot}</span>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          transaction ↗<span className="sr-only"> (opens Solana Explorer in a new tab)</span>
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {(refund || dispute) && (
          <div className="mt-6 space-y-2 border-t border-edge pt-4 text-sm">
            {dispute && <p>{dispute.summary}</p>}
            {refund && <p>{refund.summary}</p>}
          </div>
        )}
      </Card>

      <Card title="Hashes">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          The result hash is the sha256 of the exact response body the worker delivered. The client checks the
          body it received against it before the judge sees a word, so a worker cannot swap its answer after
          the fact.
        </p>
        <dl className="divide-y divide-edge text-sm">
          <HashRow label="Request (spec)" value={job.specHash} />
          <HashRow label="Result" value={job.resultHash} empty="no delivery recorded" />
        </dl>
      </Card>

      <Card title="All events">
        {job.events.length === 0 ? (
          <p className="text-sm text-muted">No events found for this job in the scanned history.</p>
        ) : (
          <ul className="divide-y divide-edge text-sm">
            {job.events.map((e) => {
              const href = safeHref(e.explorerUrl);
              return (
                <li
                  key={`${e.signature}-${e.kind}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="font-mono text-xs text-muted">{e.kind}</span>
                  <span className="min-w-0 flex-1">{e.summary}</span>
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
        {explorer && (
          <p className="mt-4 text-xs text-muted">
            <a href={explorer} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              The job account on Solana Explorer ↗
            </a>
          </p>
        )}
      </Card>
    </div>
  );
}

function HashRow({label, value, empty}: {label: string; value: string | null; empty?: string}) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <dt className="w-32 shrink-0 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 font-mono text-xs break-all">
        {value ? (
          <>
            {value}
            <CopyButton value={value} label={`Copy ${label.toLowerCase()} hash`} />
          </>
        ) : (
          <span className="font-sans text-sm text-muted">{empty}</span>
        )}
      </dd>
    </div>
  );
}
