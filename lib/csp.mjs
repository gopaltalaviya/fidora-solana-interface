/**
 * Content Security Policy, built here so a test can read it (next.config.mjs
 * only applies it).
 *
 * The browser talks to one place: this site's own `/api/v1/*` routes, which
 * read Solana on the server. So `connect-src` is `'self'`, plus another API
 * origin only when NEXT_PUBLIC_API_URL points a build at one. There is no
 * wallet, no RPC and no third-party script in the page.
 *
 * `script-src` keeps 'unsafe-inline' because Next's App Router inlines its
 * hydration data. The alternative, a per-request nonce, makes every page
 * dynamically rendered; for a site that renders no user-supplied HTML (React
 * escapes all of it, and links pass `safeHref`) that trade is not worth it.
 */

/**
 * @param {string | null} api  an absolute API URL, or null for same-origin
 * @param {boolean} dev
 */
export function contentSecurityPolicy(api, dev) {
  const extra = api && /^https?:\/\//.test(api) ? ` ${new URL(api).origin}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${extra}${dev ? ' ws:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}
