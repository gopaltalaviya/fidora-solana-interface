import type {Tone} from '@/components/ui/Badge';
import type {JobState} from './api';

/** A job's state in words, with the outcome once it is final. */
export function jobStateLabel(state: JobState, outcome: string | null): string {
  if (state === 'settled') {
    if (outcome === 'failed') return 'settled · worker failed';
    if (outcome === 'disputeLost') return 'settled · dispute lost';
    if (outcome === 'unresolved') return 'settled · unresolved';
    return 'settled · paid';
  }
  if (state === 'refunded') return 'refunded';
  if (state === 'disputed') return 'in dispute';
  if (state === 'submitted') return 'delivered · in review';
  if (state === 'accepted') return 'accepted · working';
  return 'locked · awaiting worker';
}

export function jobStateTone(state: JobState, outcome: string | null): Tone {
  if (state === 'settled') return outcome && outcome !== 'success' ? 'refused' : 'settled';
  if (state === 'refunded') return 'neutral';
  if (state === 'disputed') return 'refused';
  return 'live';
}

/** The escrow's steps in order, for the timeline. */
export const JOB_STEPS = [
  {kind: 'JobCreated', label: 'Locked', detail: 'The client locked USDC in escrow, under its spend caps.'},
  {
    kind: 'JobAccepted',
    label: 'Accepted',
    detail: 'The worker accepted and its bond was locked from its stake.',
  },
  {
    kind: 'ResultSubmitted',
    label: 'Delivered',
    detail: 'The hash of the exact response body was recorded on chain.',
  },
  {
    kind: 'JobSettled',
    label: 'Settled',
    detail: 'The judge approved (or the review window passed) and the worker was paid.',
  },
] as const;
