import {respond} from '@/lib/chain/http';
import * as svc from '@/lib/chain/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () => respond(() => svc.network());
