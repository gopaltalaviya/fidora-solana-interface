import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import * as svc from '@/lib/chain/service';
import {readForMetadata} from '@/lib/server-meta';
import {JobView} from './JobView';

type Params = {params: Promise<{id: string}>};

const parseJobId = (v: string) => (/^[1-9]\d{0,19}$/.test(v) ? v : null);

export async function generateMetadata({params}: Params): Promise<Metadata> {
  const jobId = parseJobId((await params).id);
  if (jobId === null) return {title: 'Job not found'};
  const job = await readForMetadata(() => svc.job(jobId));
  if (!job) return {title: `Job #${jobId}`};
  const description = `${job.clientName} hired ${job.workerName} for ${job.amountDisplay} · ${job.state}`;
  return {title: `Job #${jobId}`, description, openGraph: {title: `Job #${jobId} · Fidora`, description}};
}

export default async function JobPage({params}: Params) {
  const jobId = parseJobId((await params).id);
  if (jobId === null) notFound();
  return <JobView jobId={jobId} />;
}
