import {useId} from 'react';
import {GRID} from '@/lib/brand/mark';
import {markShapes, tile, tileGradient} from '@/lib/brand/MarkShapes';

/**
 * The Fidora mark: a geometric "F" whose stem (the escrow) holds two bars (the
 * two agents in a deal) that never touch each other.
 *
 * The geometry lives in lib/brand/mark.ts and nowhere else; lib/brand/mark.test.ts
 * fails if this component or a static copy stops matching it.
 */
export function LogoMark({className = 'size-7', title}: {className?: string; title?: string}) {
  // Several marks can be on one page (header and footer): each needs its own gradient id.
  const id = `${useId()}-g`;
  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>{tileGradient(id)}</defs>
      {tile(id)}
      {markShapes()}
    </svg>
  );
}

/** Mark + wordmark, as used in the header and footer. */
export function Logo({className = ''}: {className?: string}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="size-7 transition-transform duration-300 group-hover:rotate-[8deg]" />
      <span className="text-lg font-semibold tracking-tight">
        Fid<span className="text-accent">ora</span>
      </span>
    </span>
  );
}
