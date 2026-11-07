import {respond, intParam} from '@/lib/chain/http';
import * as svc from '@/lib/chain/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = (req: Request) => {
  const q = new URL(req.url).searchParams;
  const capability = q.get('capability') ?? undefined;
  return respond(() =>
    svc.agents({
      rank: q.get('rank') ?? undefined,
      capability: capability && /^[a-z0-9-]{1,48}$/.test(capability) ? capability : undefined,
      minScore: intParam(q.get('minScore'), 100),
      limit: intParam(q.get('limit'), 100),
    }),
  );
};
