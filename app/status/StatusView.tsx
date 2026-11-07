'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {Badge, StatusDot, type Tone} from '@/components/ui/Badge';
import {Button} from '@/components/ui/Button';
import {Card, Stat} from '@/components/ui/Card';
import {PageHeader} from '@/components/ui/PageHeader';
import {Loading, Skeleton} from '@/components/ui/States';
import {api, formatUnits, type StatusReport} from '@/lib/api';
import {relativeTime} from '@/lib/format';

/**
 * Is Fidora working right now, and is the money where the program says it is?
 *
 * Over `GET /v1/status`: states and numbers only, never a host or an error
 * message. The headline check is invariant I1 — the vault's token balance
 * equals everything the program owes (locked escrow, bonds, purses, stakes,
 * fees) — read from the chain on every refresh. It refreshes while the tab is
 * visible and stops when it is not.
 */

const REFRESH_MS = 15_000;

const OVERALL: Record<StatusReport['status'], {tone: Tone; word: string}> = {
  operational: {tone: 'settled', word: 'Operational'},
  degraded: {tone: 'refused', word: 'Degraded'},
  down: {tone: 'broken', word: 'Down'},
};

export function StatusView() {
  const [report, setReport] = useState<StatusReport | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    api
      .status(c.signal)
      .then((r) => {
        setReport(r);
        setUnreachable(false);
      })
      .catch(() => {
        if (!c.signal.aborted) setUnreachable(true);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    return () => {
      clearInterval(t);
      controller.current?.abort();
    };
  }, [refresh]);

  const header = (
    <PageHeader
      eyebrow="Status"
      title="Is Fidora working?"
      description="Read live from Solana: the network, the program, and whether its vault holds exactly what it owes."
      actions={
        <Button variant="secondary" size="sm" onClick={refresh} disabled={busy}>
          {busy ? 'Checking…' : 'Check now'}
        </Button>
      }
    />
  );

  if (unreachable && !report) {
    return (
      <div className="space-y-8">
        {header}
        <Overall tone="broken" word="Unreachable" detail="This site's server could not be reached." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-8">
        {header}
        <Loading label="Checking">
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </Loading>
      </div>
    );
  }

  const o = OVERALL[report.status];
  const i1 = report.invariant;
  return (
    <div className="space-y-8">
      {header}
      <Overall
        tone={o.tone}
        word={o.word}
        detail={
          report.status === 'down'
            ? (report.detail ?? 'The Solana RPC or the program could not be read.')
            : `${report.cluster === 'devnet' ? 'Solana devnet' : 'Solana localnet'} · checked ${relativeTime(report.checkedAt)}`
        }
      />

      {report.status !== 'down' && (
        <>
          <section aria-label="Checks" className="grid gap-3 md:grid-cols-3">
            <Check
              label="Solana RPC"
              ok={report.rpc === 'up'}
              okText="reachable"
              badText="unreachable"
              detail={report.slot !== null ? `slot ${report.slot.toLocaleString()}` : undefined}
            />
            <Check
              label="Program"
              ok={report.paused === false}
              okText="accepting jobs"
              badText="paused by its pauser"
              detail={`${report.programId.slice(0, 8)}…${report.programId.slice(-4)}`}
            />
            <Check
              label="Vault = what is owed (I1)"
              ok={i1?.holds === true}
              okText="holds"
              badText={i1?.holds === null ? 'vault unreadable' : 'BROKEN'}
              detail={i1 ? `${formatUnits(i1.vault ?? '0')} of ${formatUnits(i1.owed)} USDC` : undefined}
            />
          </section>

          {report.counts && report.totals && (
            <Card
              title="What the program holds"
              description="Every figure below is a field of the program's Config account. Their sum must equal the vault's balance — that is I1."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Locked in escrow" value={`${formatUnits(report.totals.locked)}`} hint="USDC" />
                <Stat label="Dispute bonds" value={formatUnits(report.totals.disputeBonds)} hint="USDC" />
                <Stat label="Agent purses" value={formatUnits(report.totals.balances)} hint="USDC" />
                <Stat label="Stakes" value={formatUnits(report.totals.stakes)} hint="USDC" />
                <Stat label="Fees owed" value={formatUnits(report.totals.feesOwed)} hint="USDC" />
              </div>
              <p className="mt-4 text-sm text-muted">
                {report.counts.agents} agent{report.counts.agents === 1 ? '' : 's'} registered ·{' '}
                {report.counts.jobs} job{report.counts.jobs === 1 ? '' : 's'} · {report.counts.openJobs} open
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Overall({tone, word, detail}: {tone: Tone; word: string; detail: string}) {
  return (
    <section
      aria-label="Overall status"
      className="flex items-center gap-4 rounded-xl border border-edge bg-surface/80 p-5 backdrop-blur-sm"
    >
      <StatusDot tone={tone} pulse={tone === 'settled'} />
      <div>
        <p className="text-lg font-semibold">{word}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </section>
  );
}

function Check({
  label,
  ok,
  okText,
  badText,
  detail,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  detail?: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface/80 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge tone={ok ? 'settled' : 'refused'} dot>
          {ok ? okText : badText}
        </Badge>
      </div>
      {detail && <p className="tabular mt-2 text-xs text-muted">{detail}</p>}
    </div>
  );
}
