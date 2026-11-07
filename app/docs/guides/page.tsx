import type {Metadata} from 'next';
import Link from 'next/link';
import {Callout, DocHeader, Step, Steps} from '@/components/docs/Doc';
import {CodeBlock} from '@/components/ui/Code';

export const metadata: Metadata = {
  title: 'Demo walkthrough',
  description:
    'A written walkthrough of the Fidora terminal demo on a local Solana validator, and where each step shows up on this site.',
};

export default function Guides() {
  return (
    <>
      <DocHeader
        section="Get started"
        title="Demo walkthrough"
        lead="What the terminal demo does, line by line, and where to see each step on this site. Every ✓ in the demo is a check against accounts on chain, not a log line."
      />

      <h2 id="start">Start it</h2>
      <p>Two terminals. In the backend, run the demo and keep the validator up:</p>
      <CodeBlock title="fidora-solana-backend" code={`DEMO_HOLD=1 npm run demo:local`} />
      <p>When it prints that it is holding the validator, start this site against it:</p>
      <CodeBlock title="fidora-solana-interface" code={`FIDORA_CLUSTER=localnet pnpm dev`} />
      <Callout type="note">
        The demo starts a <strong>fresh</strong> chain each time. If you leave this site running across two
        demo runs, restart it too, so it does not show cached reads from the old chain.
      </Callout>

      <h2 id="steps">What happens</h2>
      <Steps>
        <Step title="Workers register, stake and serve x402">
          <CodeBlock
            title="demo"
            code={`✓ 3 workers registered by their owners, wallets accepted, staked, serving x402 — agents 1, 2, 3`}
          />
          <p>
            Each worker&apos;s owner signs <code>register_agent</code>, naming the agent&apos;s wallet and its
            card URI; the wallet signs <code>accept_wallet</code>; the owner funds and stakes. The card URI
            carries the agent&apos;s name, capability and price in its fragment, so this site can show them
            from the chain alone. See them on <Link href="/agents">Agents</Link>.
          </p>
        </Step>
        <Step title="The orchestrator plans, picks a worker, and pays over x402">
          <CodeBlock
            title="demo"
            code={`plan      3 subtask(s) — …
select    agent 1 at 0.02 USDC — …
x402      job 1: locked in escrow, delivered on chain
judge     job 1: accept (quality 3)
settle    job 1 approved — worker paid`}
          />
          <p>
            The lock is <code>create_job</code>, signed by the orchestrator&apos;s wallet and relayed by the
            facilitator: the USDC is now in the program&apos;s vault. The delivery is <code>accept_job</code>{' '}
            + <code>submit_result</code>, carrying the sha256 of the exact response body. The orchestrator
            hashes the bytes it received, compares, and only then asks its judge. Each job, with its events
            and hashes, is on <Link href="/jobs">Jobs</Link>.
          </p>
        </Step>
        <Step title="A worker whose model is down is refunded in the same request">
          <CodeBlock
            title="demo"
            code={`✓ failed payment handled: the worker's model was down, x402's cancel leg declined job 4 on chain`}
          />
          <p>
            The handler fails, x402&apos;s cancel leg has the worker sign <code>decline_job</code>, and the
            client&apos;s purse is restored in full. On this site that job shows as refunded, reason{' '}
            <code>declined</code>.
          </p>
        </Step>
        <Step title="A farmed worker is refused before anything is signed">
          <CodeBlock
            title="demo"
            code={`✓ the trust check reads the farm's record from on-chain events alone: self-funded → block
✓ the orchestrator pays the farmed agent 6 → refused inside x402 before signing: COUNTERPARTY_BLOCKED`}
          />
          <p>
            The farm&apos;s owner funded the clients that paid it. The trust check sees that in the
            program&apos;s <code>Funded</code> and settlement events and returns <strong>self-funded</strong>{' '}
            → <strong>block</strong>; the x402 client aborts before signing. Open that agent&apos;s page here
            to read the same verdict and its reasons.
          </p>
        </Step>
        <Step title="Overspending is refused, by the client and by the program">
          <CodeBlock
            title="demo"
            code={`✓ the orchestrator buys the "premium report" for 1.5 USDC → refused by its x402 spend ceiling (0.1 USDC per payment)
✓ with the stolen key: hire the attacker's agent for 1.5 USDC → refused by the program: PerTaskCapExceeded
✓ with the stolen key: withdraw the purse → refused by the program: NotAgentOwner (only the owner may)`}
          />
          <p>
            A stolen agent wallet key can spend at most its on-chain caps, and can never withdraw: only the
            owner&apos;s key can.
          </p>
        </Step>
        <Step title="The vault holds exactly what is owed">
          <CodeBlock
            title="demo"
            code={`✓ I1 holds: the vault holds exactly what the program owes
Demo passed.`}
          />
          <p>
            Invariant I1: the vault&apos;s token balance equals the sum the program owes. The{' '}
            <Link href="/status">status page</Link> checks it on every read.
          </p>
        </Step>
      </Steps>

      <Callout type="warning">
        The model answers were recorded once with a local llama3 8B. Figures inside them, such as volumes and
        prices, are model output, not market data.
      </Callout>
    </>
  );
}
