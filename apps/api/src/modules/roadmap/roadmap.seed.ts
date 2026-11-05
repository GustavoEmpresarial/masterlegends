import type { PrismaClient } from '@prisma/client';

type PhaseSeed = {
  order: number;
  status: string;
  color: string;
  i18n: Record<string, { phase: string; title: string; statusLabel: string }>;
  items: Array<{
    done?: boolean;
    i18n: Record<string, { text: string }>;
  }>;
};

const SEED: PhaseSeed[] = [
  {
    order: 0,
    status: 'done',
    color: 'var(--green)',
    i18n: {
      'pt-BR': { phase: 'Fase 1', title: 'Base', statusLabel: '✅ CONCLUÍDO' },
      en: { phase: 'Phase 1', title: 'Foundation', statusLabel: '✅ DONE' },
      es: { phase: 'Fase 1', title: 'Base', statusLabel: '✅ COMPLETADO' },
    },
    items: [
      { done: true, i18n: { 'pt-BR': { text: 'Criação de clubes e edifícios' }, en: { text: 'Club creation and buildings' }, es: { text: 'Creación de clubes y edificios' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Scout e mintagem de jogadores' }, en: { text: 'Scout and player minting' }, es: { text: 'Scout y minteo de jugadores' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Pool de patrocínios da liga' }, en: { text: 'League sponsorship pool' }, es: { text: 'Pool de patrocinios de la liga' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Marketplace (compra/venda)' }, en: { text: 'Marketplace (buy/sell)' }, es: { text: 'Marketplace (compra/venta)' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Passe de Batalha' }, en: { text: 'Battle Pass' }, es: { text: 'Pase de Batalla' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Programa de indicações' }, en: { text: 'Referral program' }, es: { text: 'Programa de referidos' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Centro Técnico e recuperação de stamina' }, en: { text: 'Training Center & stamina recovery' }, es: { text: 'Centro Técnico y recuperación de stamina' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Vestiário e escalação tática' }, en: { text: 'Locker room & tactical lineup' }, es: { text: 'Vestuario y alineación táctica' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Escritório, funcionários e aflições' }, en: { text: 'Office, staff & afflictions' }, es: { text: 'Oficina, personal y aflicciones' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Mini-games diários' }, en: { text: 'Daily mini-games' }, es: { text: 'Mini-juegos diarios' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Sistema de mineração GMT' }, en: { text: 'GMT mining system' }, es: { text: 'Sistema de minería GMT' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Central de suporte com tickets' }, en: { text: 'Support center with tickets' }, es: { text: 'Centro de soporte con tickets' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Anúncios e blog da liga' }, en: { text: 'League announcements & blog' }, es: { text: 'Anuncios y blog de la liga' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Multi-idioma (PT-BR, EN, ES)' }, en: { text: 'Multi-language (PT-BR, EN, ES)' }, es: { text: 'Multi-idioma (PT-BR, EN, ES)' } } },
      { done: true, i18n: { 'pt-BR': { text: 'Notificações e atualizações em tempo real' }, en: { text: 'Real-time notifications & updates' }, es: { text: 'Notificaciones y actualizaciones en tiempo real' } } },
    ],
  },
  {
    order: 1,
    status: 'active',
    color: 'var(--gold)',
    i18n: {
      'pt-BR': { phase: 'Fase 2', title: 'Blockchain', statusLabel: '🔥 EM PROGRESSO' },
      en: { phase: 'Phase 2', title: 'Blockchain', statusLabel: '🔥 IN PROGRESS' },
      es: { phase: 'Fase 2', title: 'Blockchain', statusLabel: '🔥 EN PROGRESO' },
    },
    items: [
      { i18n: { 'pt-BR': { text: 'Chegada dos nossos estádios' }, en: { text: 'Our stadiums arriving' }, es: { text: 'Llegada de nuestros estadios' } } },
      { i18n: { 'pt-BR': { text: 'Sala de troféus' }, en: { text: 'Trophy room' }, es: { text: 'Sala de trofeos' } } },
      { i18n: { 'pt-BR': { text: 'Eventos caóticos do treinador' }, en: { text: 'Coach chaos events' }, es: { text: 'Eventos caóticos del entrenador' } } },
      { i18n: { 'pt-BR': { text: 'Sistema de fusão de NFTs' }, en: { text: 'Player fusion system' }, es: { text: 'Sistema de fusión de NFTs' } } },
    ],
  },
  {
    order: 2,
    status: 'upcoming',
    color: 'var(--blue)',
    i18n: {
      'pt-BR': { phase: 'Fase 3', title: 'Competição', statusLabel: '🔜 EM BREVE' },
      en: { phase: 'Phase 3', title: 'Competition', statusLabel: '🔜 COMING SOON' },
      es: { phase: 'Fase 3', title: 'Competición', statusLabel: '🔜 PRÓXIMAMENTE' },
    },
    items: [
      { i18n: { 'pt-BR': { text: 'Arena PvP e partidas ranqueadas' }, en: { text: 'PvP arena and ranked matches' }, es: { text: 'Arena PvP y partidas clasificatorias' } } },
      { i18n: { 'pt-BR': { text: 'Rankings globais de clubes' }, en: { text: 'Global club rankings' }, es: { text: 'Rankings globales de clubes' } } },
      { i18n: { 'pt-BR': { text: 'Torneios de temporada' }, en: { text: 'Season tournaments' }, es: { text: 'Torneos de temporada' } } },
      { i18n: { 'pt-BR': { text: 'Token de governança (MLL)' }, en: { text: 'Governance token (MLL)' }, es: { text: 'Token de gobernanza (MLL)' } } },
    ],
  },
  {
    order: 3,
    status: 'upcoming',
    color: 'var(--purple)',
    i18n: {
      'pt-BR': { phase: 'Fase 4', title: 'Expansão', statusLabel: '🔜 EM BREVE' },
      en: { phase: 'Phase 4', title: 'Expansion', statusLabel: '🔜 COMING SOON' },
      es: { phase: 'Fase 4', title: 'Expansión', statusLabel: '🔜 PRÓXIMAMENTE' },
    },
    items: [
      { i18n: { 'pt-BR': { text: 'App mobile (iOS e Android)' }, en: { text: 'Mobile app (iOS & Android)' }, es: { text: 'App móvil (iOS y Android)' } } },
      { i18n: { 'pt-BR': { text: 'Mini-games e missões secundárias' }, en: { text: 'Training minigames and side quests' }, es: { text: 'Mini-juegos y misiones secundarias' } } },
      { i18n: { 'pt-BR': { text: 'Bridge cross-chain' }, en: { text: 'Cross-chain bridge' }, es: { text: 'Puente cross-chain' } } },
      { i18n: { 'pt-BR': { text: 'Governança DAO' }, en: { text: 'DAO governance' }, es: { text: 'Gobernanza DAO' } } },
    ],
  },
];

export async function seedRoadmapIfEmpty(prisma: PrismaClient): Promise<void> {
  const count = await prisma.roadmapPhase.count();
  if (count > 0) return;

  for (const phase of SEED) {
    await prisma.roadmapPhase.create({
      data: {
        order: phase.order,
        status: phase.status,
        color: phase.color,
        visible: true,
        i18n: phase.i18n,
        items: {
          create: phase.items.map((item, idx) => ({
            order: idx,
            done: item.done ?? false,
            visible: true,
            i18n: item.i18n,
          })),
        },
      },
    });
  }
}
