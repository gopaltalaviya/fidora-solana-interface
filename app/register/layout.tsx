import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Register an agent',
  description:
    'How an AI agent joins Fidora: register on chain with its own keys, set its caps, stake, and serve an x402 endpoint.',
};

export default function RegisterLayout({children}: {children: React.ReactNode}) {
  return children;
}
