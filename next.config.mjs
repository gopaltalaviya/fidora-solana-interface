import {PHASE_DEVELOPMENT_SERVER} from 'next/constants.js';
import {contentSecurityPolicy} from './lib/csp.mjs';

/**
 * The API is this site's own route handlers (app/api/v1), so by default the
 * browser calls `/api` on the same origin and nothing needs configuring.
 * NEXT_PUBLIC_API_URL can point a build at another copy of those routes.
 */
function apiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`NEXT_PUBLIC_API_URL must be http(s): ${raw}`);
  }
  return raw.replace(/\/$/, '');
}

/** @param {string} phase */
export default function config(phase) {
  const api = apiUrl();
  const dev = phase === PHASE_DEVELOPMENT_SERVER;

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    ...(api ? {env: {NEXT_PUBLIC_API_URL: api}} : {}),
    // The jobs are listed on the activity feed; each has its own page at
    // /jobs/<id>. The docs (and links people share) say /jobs.
    async redirects() {
      return [{source: '/jobs', destination: '/activity', permanent: false}];
    },
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {key: 'Content-Security-Policy', value: contentSecurityPolicy(api, dev)},
            {key: 'X-Content-Type-Options', value: 'nosniff'},
            {key: 'X-Frame-Options', value: 'DENY'},
            {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
            {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()'},
            ...(dev
              ? []
              : [{key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains'}]),
          ],
        },
      ];
    },
  };
  return nextConfig;
}
