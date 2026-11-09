import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SCOUT_RARITY_ORDER } from '@mll/shared';
import { RoadmapContent } from '../../components/roadmap/RoadmapContent';
import { useRoadmap } from '../../hooks/useRoadmap';
import { useScoutRules } from '../../hooks/useApi';
import { PageContentShell, PageHero } from '../../components/content';
import { RARITY_HEX } from '../../components/stadium/stadiumBonecoTheme';

function Row({ label, value, color = 'var(--text-primary)' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.07] last:border-0">
      <span className="retro-text text-sm sm:text-base" style={{ color: '#ffffff', flexShrink: 0 }}>{label}</span>
      <span className="retro-text text-sm sm:text-base text-right font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

interface SectionProps {
  icon: string;
  title: string;
  color: string;
  index: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ icon, title, color, index, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.04 }}
      className="pixel-card pixel-card-fluid overflow-hidden w-full min-w-0"
      style={{ borderTopColor: color, padding: 0 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
        aria-expanded={open}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <i className={`bi ${icon} text-lg shrink-0`} style={{ color }} aria-hidden />
          <h2 className="pixel-text text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        </div>
        <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} shrink-0`} style={{ color }} aria-hidden />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-6 sm:px-7 sm:pb-8 space-y-4 border-t border-white/[0.06] pt-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="pixel-box-light p-4 sm:p-5 space-y-2 w-full min-w-0">
      {children}
    </div>
  );
}

const RARITY_WP_COLOR: Record<string, string> = {
  common: RARITY_HEX.common,
  uncommon: RARITY_HEX.uncommon,
  rare: RARITY_HEX.rare,
  'super-rare': RARITY_HEX['super-rare'],
  epic: RARITY_HEX.epic,
  legendary: RARITY_HEX.legendary,
};

const RARITY_WP_KEY: Record<string, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  'super-rare': 'superRare',
  epic: 'epic',
  legendary: 'legendary',
};

function formatChance(pct: number | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  if (pct >= 1 && Number.isInteger(pct)) return `${pct}%`;
  if (pct < 0.1) return `${pct.toFixed(4).replace(/\.?0+$/, '')}%`;
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function WhitepaperPage() {
  const { t } = useTranslation('whitepaper');
  const { data: roadmapData, isLoading: roadmapLoading } = useRoadmap();
  const { data: scoutRules } = useScoutRules();
  const rulesById = new Map((scoutRules?.rarities ?? []).map((rule) => [rule.id, rule]));

  const rarities = SCOUT_RARITY_ORDER.map((id) => {
    const rule = rulesById.get(id);
    return {
      key: RARITY_WP_KEY[id] ?? id,
      color: RARITY_WP_COLOR[id] ?? '#aaaaaa',
      chance: formatChance(rule?.chancePct),
      ovr: rule ? `${rule.overwallMin}–${rule.overwallMax}` : '—',
      drain: rule ? `-${rule.staminaDrainPerHour}/h` : '—',
    };
  });

  const staminaDrainRows = [...SCOUT_RARITY_ORDER].reverse().map((id) => {
    const rule = rulesById.get(id);
    return {
      label: t(`scout.rarities.${RARITY_WP_KEY[id] ?? id}`),
      drain: rule ? `-${rule.staminaDrainPerHour}/h` : '—',
      color: RARITY_WP_COLOR[id] ?? '#aaaaaa',
    };
  });

  const buildings = [
    { key: 'stadium', icon: 'bi-building', color: 'var(--green)' },
    { key: 'locker', icon: 'bi-droplet-fill', color: 'var(--cyan)' },
    { key: 'ct', icon: 'bi-lightning-charge-fill', color: 'var(--blue)' },
    { key: 'trophy', icon: 'bi-trophy-fill', color: 'var(--gold)' },
    { key: 'office', icon: 'bi-building-fill', color: 'var(--purple)' },
  ] as const;

  return (
    <PageContentShell className="pb-12">
      <PageHero title={t('title')} titleColor="var(--gold)" subtitle={t('subtitle')} />
      <p className="text-center retro-text text-xs -mt-4" style={{ color: 'var(--text-muted)' }}>{t('version')}</p>

      <div className="space-y-3 w-full min-w-0">
        {/* 1 — Intro */}
        <Section icon="bi-shield-fill" title={t('intro.title')} color="var(--green)" index={0} defaultOpen>
          <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>{t('intro.body1')}</p>
          <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>{t('intro.body2')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('intro.blockchain'), value: 'Polygon' },
              { label: t('intro.currency'), value: 'USDC' },
              { label: t('intro.players'), value: t('intro.playersValue') },
              { label: t('intro.version'), value: t('intro.versionValue') },
            ].map((item) => (
              <div key={item.label} className="px-3 py-3 text-center" style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 10, borderTop: '3px solid var(--green)' }}>
                <p className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                <p className="pixel-text text-sm sm:text-base mt-1" style={{ color: 'var(--green)' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 2 — Scout */}
        <Section icon="bi-suit-club-fill" title={t('scout.title')} color="var(--blue)" index={1}>
          <p className="retro-text text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            {t('scout.body', { price: '2 USDC', max: 10 })}
          </p>
          <div className="space-y-2">
            {rarities.map((r) => {
              const pct = Number.parseFloat(r.chance);
              const bar = Number.isFinite(pct) ? Math.max(1.5, Math.min(100, pct)) : 0;
              return (
                <div key={r.key} className="px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 10 }}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="retro-text text-sm font-bold min-w-0" style={{ color: r.color }}>{t(`scout.rarities.${r.key}`)}</span>
                    <span className="retro-text text-xs shrink-0 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {r.chance} · OVR {r.ovr} · <span style={{ color: 'var(--red)' }}>{r.drain}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full mt-2 overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 4 }}>
                    <div style={{ width: `${bar}%`, height: '100%', background: r.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>{t('scout.staminaNote')}</p>
        </Section>

        {/* 3 — Farming */}
        <Section icon="bi-cash-stack" title={t('farming.title')} color="var(--gold)" index={2}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('farming.body')}</p>
          <InfoBox>
            <p className="retro-text text-xs sm:text-sm tracking-widest" style={{ color: '#ffffff' }}>{t('farming.formulaLabel')}</p>
            <p className="pixel-text text-lg sm:text-xl" style={{ color: 'var(--gold)' }}>{t('farming.formula')}</p>
            <p className="retro-text text-xs sm:text-sm" style={{ color: '#ffffff' }}>{t('farming.formulaNote')}</p>
          </InfoBox>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <div>
              <Row label={t('farming.minLineup')} value={t('farming.minLineupValue')} />
              <Row label={t('farming.maxAccum')} value={t('farming.maxAccumValue')} />
              <Row label={t('farming.claimAt')} value={t('farming.claimAtValue')} color="var(--green)" />
            </div>
            <div>
              <Row label={t('farming.bonusPerLevel')} value={t('farming.bonusPerLevelValue')} color="var(--gold)" />
              <Row label={t('farming.stadiumInitial')} value={t('farming.stadiumInitialValue')} />
              <Row label={t('farming.stadiumMax')} value={t('farming.stadiumMaxValue')} color="var(--green)" />
            </div>
          </div>
        </Section>

        {/* 4 — Stamina */}
        <Section icon="bi-lightning-charge-fill" title={t('stamina.title')} color="var(--cyan)" index={3}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('stamina.body')}</p>
          <div>
            <Row label={t('stamina.maxStamina')} value="100" />
            <Row label={t('stamina.benchNote')} value={t('stamina.benchNoteValue')} />
            <Row label={t('stamina.recovery')} value="+24/h" color="var(--green)" />
          </div>
          <p className="retro-text text-xs sm:text-sm tracking-widest mt-2" style={{ color: '#ffffff' }}>{t('stamina.drainTitle')}</p>
          <div className="space-y-2">
            {staminaDrainRows.map((row) => (
              <div key={row.label} className="px-3 py-2 flex items-center justify-between gap-3" style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 10, borderLeft: `3px solid ${row.color}` }}>
                <span className="retro-text text-sm font-semibold" style={{ color: row.color }}>{row.label}</span>
                <span className="pixel-text text-sm font-bold" style={{ color: 'var(--red)' }}>{row.drain}</span>
              </div>
            ))}
          </div>
          <p className="retro-text text-sm sm:text-base" style={{ color: '#ffffff' }}>{t('stamina.coachNote')}</p>
        </Section>

        {/* 5 — Merger */}
        <Section icon="bi-shuffle" title={t('merger.title')} color="var(--purple)" index={4}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('merger.body')}</p>
          <div>
            <Row label={t('merger.commonToUncommon')} value="0,25 GMT" color="var(--purple)" />
            <Row label={t('merger.uncommonToRare')} value="0,50 GMT" color="var(--purple)" />
            <Row label={t('merger.rareToSuperRare')} value="1 GMT" color="var(--purple)" />
            <Row label={t('merger.superRareToEpic')} value="2 GMT" color="var(--purple)" />
            <Row label={t('merger.epicToLegendary')} value="3 GMT" color="var(--purple)" />
            <Row label={t('merger.legendaryValue')} value="3.125 GMT" color="var(--purple)" />
          </div>
          <p className="retro-text text-sm sm:text-base" style={{ color: '#ffffff' }}>{t('merger.note')}</p>
        </Section>

        {/* 6 — Marketplace */}
        <Section icon="bi-cart-fill" title={t('marketplace.title')} color="var(--orange, #ff9800)" index={5}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('marketplace.body')}</p>
          <div>
            <Row label={t('marketplace.saleFee')} value="10%" color="var(--red)" />
            <Row label={t('marketplace.withdrawFee')} value="5%" color="var(--red)" />
            <Row label={t('marketplace.basePlayers')} value={t('marketplace.basePlayersValue')} color="#ffffff" />
            <Row label={t('marketplace.referralNfts')} value={t('marketplace.referralNftsValue')} color="#ffffff" />
            <Row label={t('marketplace.scoutNfts')} value={t('marketplace.scoutNftsValue')} color="var(--green)" />
          </div>
        </Section>

        {/* 7 — Buildings */}
        <Section icon="bi-cone-striped" title={t('buildings.title')} color="var(--green)" index={6}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>
            {t('buildings.body', { formula: '100 × 1.5^nível USDC' })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            {buildings.map((b) => (
              <div key={b.key} className="flex items-start gap-3 p-3" style={{ background: 'rgba(0,0,0,0.28)', borderRadius: 10, borderTop: `3px solid ${b.color}` }}>
                <i className={`bi ${b.icon} text-xl`} style={{ color: b.color }} aria-hidden />
                <div>
                  <p className="retro-text text-base sm:text-lg font-bold" style={{ color: '#ffffff' }}>{t(`buildings.${b.key}.name`)}</p>
                  <p className="retro-text text-sm sm:text-base mt-1" style={{ color: '#ffffff' }}>{t(`buildings.${b.key}.bonus`)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 8 — Referral */}
        <Section icon="bi-people-fill" title={t('referral.title')} color="var(--pink, #e91e8c)" index={7}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('referral.body')}</p>
          <div>
            <Row label={t('referral.depositCommission')} value="5%" color="var(--green)" />
            <Row label={t('referral.scoutCommission')} value="5%" color="var(--green)" />
            <Row label={t('referral.referrerNft')} value={t('referral.referrerNftValue')} color="var(--gold)" />
            <Row label={t('referral.referredNft')} value={t('referral.referredNftValue')} color="var(--cyan)" />
          </div>
          <p className="retro-text text-sm sm:text-base" style={{ color: '#ffffff' }}>{t('referral.note')}</p>
        </Section>

        {/* 9 — Season Pass */}
        <Section icon="bi-ticket-perforated-fill" title={t('pass.title')} color="var(--gold)" index={8}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('pass.body', { price: '500 USDC' })}</p>
          <p className="retro-text text-xs sm:text-sm tracking-widest" style={{ color: '#ffffff' }}>{t('pass.xpLabel')}</p>
          <div>
            <Row label={t('pass.scoutXp')} value="+150 XP" color="var(--blue)" />
            <Row label={t('pass.buyXp')} value="+120 XP" color="var(--green)" />
            <Row label={t('pass.sellXp')} value="+80 XP" color="var(--gold)" />
            <Row label={t('pass.mergeXp')} value="+80 XP" color="var(--purple)" />
          </div>
        </Section>

        {/* 10 — Museum */}
        <Section icon="bi-bank" title={t('museum.title')} color="var(--text-secondary, #888)" index={9}>
          <p className="retro-text text-base sm:text-lg" style={{ color: '#ffffff' }}>{t('museum.body')}</p>
          <div>
            <Row label={t('museum.trophies')} value={t('museum.trophiesValue')} />
            <Row label={t('museum.retired')} value={t('museum.retiredValue')} />
            <Row label={t('museum.stadiums')} value={t('museum.stadiumsValue')} />
            <Row label={t('museum.lifetime')} value={t('museum.lifetimeValue')} color="var(--gold)" />
          </div>
        </Section>

        {/* 11 — Roadmap */}
        <Section icon="bi-map-fill" title={t('roadmap.title')} color="var(--cyan)" index={10}>
          {roadmapLoading ? (
            <p className="retro-text text-sm" style={{ color: '#ffffff' }}>…</p>
          ) : (
            <RoadmapContent phases={roadmapData?.phases ?? []} compact />
          )}
        </Section>
      </div>
    </PageContentShell>
  );
}