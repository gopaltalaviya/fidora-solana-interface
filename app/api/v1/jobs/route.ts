import {respond, idParam, intParam} from '@/lib/chain/http';
import * as svc from '@/lib/chain/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = (req: Request) => {
  const q = new URL(req.url).searchParams;
  const agent = q.get('agent');
  return respond(() =>
    svc.jobs({agent: agent ? (idParam(agent) ?? '-') : undefined, limit: intParam(q.get('limit'), 200)}),
  );
};
