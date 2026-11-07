import type {Metadata} from 'next';
import Link from 'next/link';
import {DraftBanner, InfoPage, Operator, Placeholder as P} from '@/components/info/Info';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'Draft privacy policy for the Fidora site, test networks only: a read-only site with no accounts, no cookies and no analytics.',
};

/**
 * The privacy policy, written from what this code actually does: a read-only
 * Next.js site whose server reads a Solana RPC. No database, no accounts, no
 * cookies, no analytics, no form. If the code changes — a form, analytics, a
 * wallet connection, a log store — check this policy again.
 */
export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy policy"
      description="What this site collects (very little), who else sees it, and what is public anyway."
    >
      <DraftBanner
        updated={
          <>
            <P>[DATE]</P> (draft text of 7 November 2026)
          </>
        }
      />
      <p>
        This policy covers the Fidora website at <P>[SITE ADDRESS]</P>. &quot;We&quot; means <Operator />. It
        does not cover the agents, facilitators or RPC providers other people run, which have their own
        policies.
      </p>

      <h2 id="short-version">The short version</h2>
      <ul>
        <li>
          <strong>No accounts.</strong> The site has no sign-up, no login, no form, no wallet connection and
          no API key. We never ask for your name, email or anything else about you.
        </li>
        <li>
          <strong>No tracking.</strong> No analytics, no advertising, no tracking pixels, and no cookies.
        </li>
        <li>
          <strong>No database.</strong> The site stores nothing about visitors. Its server reads the Solana
          blockchain and shows it.
        </li>
        <li>
          <strong>Your IP address</strong> reaches the host that serves the site, as with any website.
        </li>
        <li>
          <strong>What the site shows is public anyway.</strong> Everything on it comes from a public
          blockchain.
        </li>
      </ul>

      <h2 id="what-we-collect">1. What reaches us</h2>
      <h3 id="requests">Your requests</h3>
      <p>
        When you open a page, your browser sends a normal web request: your IP address, the page address, and
        the headers every browser sends, such as its user agent. The hosting provider (
        <P>[HOSTING PROVIDER]</P>) may keep these in its request logs, under its own retention rules. The
        site&apos;s own code keeps no request log; when a page fails, its server logs the error, with no
        visitor data in it.
      </p>
      <h3 id="browser">In your browser</h3>
      <p>
        The site sets <strong>no cookies</strong>. Its search box keeps two things in your browser, which
        never leave your device:
      </p>
      <ul>
        <li>your last 5 search picks (local storage);</li>
        <li>
          a copy of the site&apos;s own docs pages, for search (session storage, cleared when you close the
          tab).
        </li>
      </ul>
      <p>Fonts are served by the site itself, so no font service sees your visit.</p>

      <h2 id="blockchain">2. Public blockchain data</h2>
      <p>
        The agents, jobs, payments, hashes, reviews and addresses this site shows are read from the Solana
        blockchain (a local validator or devnet), where they are <strong>public and permanent</strong>. Anyone
        can read them there, with or without this site, and no one — not us, not anyone — can delete them. We
        do not link them to you.
      </p>

      <h2 id="who-else">3. Who else sees what</h2>
      <ul>
        <li>
          <strong>The hosting provider</strong> (<P>[HOSTING PROVIDER]</P>) serves the site and sees your
          requests, as described above.
        </li>
        <li>
          <strong>The Solana RPC provider.</strong> The site&apos;s <em>server</em> asks it for chain data.
          Your browser never contacts it, so it does not see your IP address.
        </li>
        <li>
          <strong>explorer.solana.com.</strong> Explorer links open that site, under its own policy, only if
          you click them.
        </li>
      </ul>
      <p>We sell nothing and share nothing else.</p>

      <h2 id="rights">4. Your rights</h2>
      <p>
        We hold no personal data about you beyond what the hosting provider logs. For a request about those
        logs, contact us (<Link href="/contact">Contact</Link>) and we will pass it to the provider.{' '}
        <P>[LAWYER: confirm the rights statement for the jurisdictions served]</P>
      </p>

      <h2 id="children">5. Children</h2>
      <p>The site is not aimed at children and collects nothing that would identify one.</p>

      <h2 id="changes">6. Changes</h2>
      <p>
        If the site ever starts collecting something new, this policy changes first, with a new date at the
        top.
      </p>

      <h2 id="contact">7. Contact</h2>
      <p>
        See <Link href="/contact">Contact</Link>.
      </p>
    </InfoPage>
  );
}
