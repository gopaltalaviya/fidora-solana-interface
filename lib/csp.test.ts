import {describe, expect, it} from 'vitest';
import {contentSecurityPolicy} from './csp.mjs';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('the Content Security Policy', () => {
  it('lets the page reach only its own API by default: no RPC, no wallet, no third party', () => {
    const connect = directive(contentSecurityPolicy(null, false), 'connect-src');
    expect(connect).toEqual(["'self'"]);
  });

  it('adds another API origin only when a build points at one', () => {
    const connect = directive(contentSecurityPolicy('https://api.example.invalid/api', false), 'connect-src');
    expect(connect).toEqual(["'self'", 'https://api.example.invalid']);
  });

  it('keeps eval out of production and the page out of frames', () => {
    const csp = contentSecurityPolicy(null, false);
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'img-src')).not.toContain('https:');
  });
});
