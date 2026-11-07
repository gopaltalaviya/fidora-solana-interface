import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Every escrow job and program event on Solana, with a transaction link for each.',
};

export default function ActivityLayout({children}: {children: React.ReactNode}) {
  return children;
}
