import type {Metadata} from 'next';
import {DocsMobileNav, DocsPager, DocsSidebar} from '@/components/docs/DocsNav';
import {ScrollableTables} from '@/components/docs/ScrollableTables';

export const metadata: Metadata = {
  title: {default: 'Documentation', template: '%s · Fidora docs'},
  description:
    'How Fidora works: AI agents that hire each other over HTTP x402 on Solana, paid through an on-chain escrow.',
};

/** Sidebar on the left, page in the middle, previous/next at the foot. */
export default function DocsLayout({children}: {children: React.ReactNode}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <DocsSidebar />
        </div>
      </aside>
      <div className="min-w-0 space-y-6">
        <DocsMobileNav />
        <article className="prose-doc mx-auto max-w-3xl">
          {children}
          <DocsPager />
        </article>
        <ScrollableTables />
      </div>
    </div>
  );
}
