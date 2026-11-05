import { PLAYER_CAREER_RETIRE_AGE, PLAYER_CAREER_START_AGE } from '@mll/shared';
import { hasPlayerAge, type PlayerAgeFields } from './PlayerAgeBadge';

function careerPct(age: number): number {
  return Math.min(
    100,
    Math.max(
      0,
      ((age - PLAYER_CAREER_START_AGE) / (PLAYER_CAREER_RETIRE_AGE - PLAYER_CAREER_START_AGE)) * 100,
    ),
  );
}

const uiFont = 'var(--font-sans)';

/**
 * Tempo de vida / carreira (18→40) — tipografia legível (sem pixel miúdo).
 */
export function PlayerCareerLife({
  player,
  compact = false,
  className = '',
}: {
  player: PlayerAgeFields | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!hasPlayerAge(player)) return null;
  const age = player!.age ?? PLAYER_CAREER_START_AGE;
  const pct = careerPct(age);
  const yearsLeft = Math.max(0, PLAYER_CAREER_RETIRE_AGE - age);
  const roi = player?.roiPct;
  const roiLabel =
    roi != null && Number.isFinite(roi)
      ? `${Number.isInteger(roi) ? roi : roi.toFixed(0)}%`
      : null;

  if (compact) {
    return (
      <div
        className={`w-full rounded-lg px-2.5 py-2 ${className}`.trim()}
        style={{
          fontFamily: uiFont,
          background: 'rgba(0,0,0,0.72)',
          border: '1px solid rgba(250, 204, 21, 0.55)',
        }}
      >
        <div className="flex items-end justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: '#fde68a' }}
            >
              Idade
            </p>
            <p className="text-xs font-medium leading-tight mt-0.5" style={{ color: '#f8fafc' }}>
              {yearsLeft > 0 ? `${yearsLeft} anos até o Museu` : 'Pronto pro Museu'}
            </p>
          </div>
          <p className="shrink-0 tabular-nums font-bold leading-none" style={{ color: '#facc15', fontSize: 22 }}>
            {age}
            <span className="text-sm font-semibold" style={{ color: '#94a3b8' }}>
              /{PLAYER_CAREER_RETIRE_AGE}
            </span>
          </p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(15,23,42,0.95)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(pct, age <= PLAYER_CAREER_START_AGE ? 4 : pct)}%`,
              background: 'linear-gradient(90deg, #ca8a04, #facc15)',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-xl p-4 text-left ${className}`.trim()}
      style={{
        fontFamily: uiFont,
        background: 'rgba(15, 23, 42, 0.95)',
        border: '2px solid #facc15',
        boxShadow: '0 0 0 1px rgba(250, 204, 21, 0.25)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: '#fde68a' }}>
            Tempo de vida
          </p>
          <p className="mt-1.5 text-base font-semibold leading-snug" style={{ color: '#f8fafc' }}>
            {yearsLeft > 0
              ? `${yearsLeft} anos até o Museu`
              : 'Carreira no fim — Museu'}
          </p>
          <p className="mt-1 text-sm leading-snug" style={{ color: '#cbd5e1' }}>
            Aposentadoria aos {PLAYER_CAREER_RETIRE_AGE}
            {roiLabel ? ` · ROI ${roiLabel}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums font-bold leading-none" style={{ color: '#facc15', fontSize: 36 }}>
            {age}
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: '#94a3b8' }}>
            de {PLAYER_CAREER_RETIRE_AGE} anos
          </p>
        </div>
      </div>

      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full"
        style={{ background: 'rgba(2,6,23,0.9)', border: '1px solid rgba(250,204,21,0.35)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(pct, age <= PLAYER_CAREER_START_AGE ? 4 : pct)}%`,
            background: 'linear-gradient(90deg, #a16207, #facc15)',
          }}
        />
      </div>
    </div>
  );
}
