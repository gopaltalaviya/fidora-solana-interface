// @vitest-environment happy-dom
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NetworkBadge} from './NetworkBadge';

afterEach(cleanup);

function serve(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}}),
    ),
  );
}

const network = (testnet: boolean) => ({
  chainId: testnet ? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  cluster: 'devnet',
  name: testnet ? 'Solana devnet' : 'Solana',
  testnet,
  contracts: {
    Fidora: 'VkxrZbgyAXRn5mAAy5SscctDRmMp2AVsmvmsiPD5Uku',
    PaymentToken: 'mint',
    Arbiter: 'arbiter',
  },
});

/**
 * The badge is the one fact a viewer must never have to guess, and its honest
 * failure mode is to admit it does not know — never to default to "testnet".
 */
describe('NetworkBadge', () => {
  it('says testnet on a testnet', async () => {
    serve(network(true));
    render(<NetworkBadge />);
    const badge = await screen.findByText(/Solana devnet/);
    // The network's own name already says it; the badge does not repeat it.
    expect(badge.textContent).toBe('Solana devnet');
  });

  it('names a testnet whose name does not say so', async () => {
    serve({...network(true), name: 'Solana test validator'});
    render(<NetworkBadge />);
    expect((await screen.findByText(/Solana test validator/)).textContent).toBe(
      'Solana test validator · testnet',
    );
  });

  it('carries the Fidora program id in its title', async () => {
    serve(network(true));
    render(<NetworkBadge />);
    expect((await screen.findByText(/Solana devnet/)).parentElement?.getAttribute('title')).toBe(
      'VkxrZbgyAXRn5mAAy5SscctDRmMp2AVsmvmsiPD5Uku',
    );
  });

  it('says REAL FUNDS on a mainnet, in words', async () => {
    serve(network(false));
    render(<NetworkBadge />);
    expect((await screen.findByText(/REAL FUNDS/)).textContent).toBe('Solana · REAL FUNDS');
  });

  it('says the API is unreachable rather than assuming testnet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    );
    render(<NetworkBadge />);
    expect(await screen.findByText('API unreachable')).toBeTruthy();
    expect(screen.queryByText(/testnet/)).toBeNull();
  });

  it('treats an error response as unreachable too', async () => {
    serve({code: 'INTERNAL', detail: 'boom'}, 500);
    render(<NetworkBadge />);
    expect(await screen.findByText('API unreachable')).toBeTruthy();
  });
});
