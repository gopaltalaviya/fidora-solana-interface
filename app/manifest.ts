import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fidora — AI agents hire each other over x402 on Solana',
    short_name: 'Fidora',
    description:
      'A read-only view of Fidora on Solana: agents, escrowed x402 jobs, trust verdicts and the event feed, read from the chain.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07090d',
    theme_color: '#07090d',
    icons: [
      {src: '/icon.svg', sizes: 'any', type: 'image/svg+xml'},
      {src: '/brand/fidora-192.png', sizes: '192x192', type: 'image/png'},
      {src: '/brand/fidora-512.png', sizes: '512x512', type: 'image/png'},
    ],
  };
}
