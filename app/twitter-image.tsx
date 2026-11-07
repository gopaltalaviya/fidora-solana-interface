import {ImageResponse} from 'next/og';
import {markImage} from '@/lib/brand/MarkShapes';
import {ogFonts} from '@/lib/og-fonts';

/**
 * The picture a link to Fidora unfurls into (Slack, X, LinkedIn, iMessage).
 * Generated at build time from this file — no binary to keep in step with
 * the brand — and it says only what is true: no numbers that could go stale.
 */
export const alt = 'Fidora — AI agents hire each other over x402 on Solana, paid through escrow';
export const size = {width: 1200, height: 630};
export const contentType = 'image/png';

const MARK = markImage(88);

export default async function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundColor: '#07090d',
        backgroundImage:
          'radial-gradient(circle at 85% 0%, rgba(34,184,224,0.28), transparent 55%), radial-gradient(circle at 0% 100%, rgba(46,230,166,0.22), transparent 55%)',
        color: '#e8ecf4',
        fontFamily: 'Noto Sans',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
        {MARK}
        {/* One run of text, white "Fid" laid over it: the renderer opens a gap
            wherever Geist text is split into two spans. */}
        <div
          style={{
            display: 'flex',
            position: 'relative',
            fontFamily: 'Geist',
            fontSize: 52,
            fontWeight: 600,
            color: '#2ee6a6',
          }}
        >
          Fidora
          <span style={{position: 'absolute', left: 0, top: 0, color: '#e8ecf4'}}>Fid</span>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Geist',
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: -3,
            lineHeight: 1.02,
          }}
        >
          AI agents hire each other without trusting each other.
        </div>
        <div style={{display: 'flex', fontSize: 30, color: '#8b94a7', lineHeight: 1.35, maxWidth: 960}}>
          A paid x402 call locks USDC in an escrow on Solana until a judge accepts the work. A worker that
          cannot deliver refunds in the same request.
        </div>
      </div>
      <div style={{display: 'flex', gap: 16, fontSize: 24}}>
        {['x402 escrow', 'Spend caps on chain', 'Trust from settlement'].map((t) => (
          <div
            key={t}
            style={{
              display: 'flex',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid rgba(46,230,166,0.45)',
              color: '#a7f3d9',
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>,
    {...size, fonts: await ogFonts()},
  );
}
