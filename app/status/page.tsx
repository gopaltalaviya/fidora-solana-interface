import type {Metadata} from 'next';
import {StatusView} from './StatusView';

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Whether Fidora is working right now: the Solana RPC, the program, and whether its vault holds exactly what it owes.',
};

export default function StatusPage() {
  return <StatusView />;
}
