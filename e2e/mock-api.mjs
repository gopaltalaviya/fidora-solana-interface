/**
 * The e2e API: Fidora's own `/api/v1/*` routes, answered from responses
 * RECORDED from a real local chain after `npm run demo:local` (e2e/fixtures).
 * So the browser tests exercise the pages against real shapes and real
 * numbers — the farm really is self-funded, job 4 really was refunded —
 * without needing a validator in CI.
 *
 * Re-record with a held demo and the dev server up:
 *   for p in network status ...; do curl -s localhost:3200/api/v1/$p > e2e/fixtures/...; done
 */
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name) => JSON.parse(readFileSync(join(HERE, `${name}.json`), 'utf8'));
const PORT = Number(process.env.MOCK_API_PORT ?? 8787);

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': status >= 400 ? 'application/problem+json' : 'application/json',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}
const notFound = (res, what) => send(res, 404, {status: 404, code: 'NOT_FOUND', detail: `no ${what}`});

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/^\/api/, '');
  if (path === '/v1/network') return send(res, 200, fixture('network'));
  if (path === '/v1/status') return send(res, 200, fixture('status'));
  if (path === '/v1/agents') {
    let agents = fixture('agents').agents;
    const cap = url.searchParams.get('capability');
    if (cap) agents = agents.filter((a) => a.capabilities.includes(cap));
    return send(res, 200, {agents});
  }
  let m = /^\/v1\/agents\/(\d+)\/trust$/.exec(path);
  if (m) {
    try {
      return send(res, 200, fixture(`trust-${m[1]}`));
    } catch {
      return notFound(res, 'agent');
    }
  }
  m = /^\/v1\/agents\/(\d+)$/.exec(path);
  if (m) {
    try {
      return send(res, 200, fixture(`agent-${m[1]}`));
    } catch {
      return notFound(res, 'agent');
    }
  }
  if (path === '/v1/jobs') {
    let jobs = fixture('jobs').jobs;
    const agent = url.searchParams.get('agent');
    if (agent) jobs = jobs.filter((j) => j.client === agent || j.worker === agent);
    return send(res, 200, {jobs});
  }
  m = /^\/v1\/jobs\/(\d+)$/.exec(path);
  if (m) {
    try {
      return send(res, 200, fixture(`job-${m[1]}`));
    } catch {
      return notFound(res, 'job');
    }
  }
  if (path === '/v1/activity') return send(res, 200, fixture('activity'));
  return notFound(res, 'route');
}).listen(PORT, '127.0.0.1', () => console.warn(`mock API on http://127.0.0.1:${PORT}/api/v1`));
