import {respond, idParam} from '@/lib/chain/http';
import * as svc from '@/lib/chain/service';
import {NotFound} from '@/lib/chain/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async (_req: Request, {params}: {params: Promise<{id: string}>}) => {
  const id = idParam((await params).id);
  return respond(() => (id ? svc.agent(id) : Promise.reject(new NotFound('no such agent'))));
};
