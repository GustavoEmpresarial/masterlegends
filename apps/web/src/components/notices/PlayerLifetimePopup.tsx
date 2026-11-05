import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  PLAYER_CAREER_RETIRE_AGE,
  PLAYER_CAREER_START_AGE,
  PLAYER_ROI_RETIRE_MULTIPLIER,
} from '@mll/shared';

/** Bump version when copy changes so players see the improved popup again. */
const STORAGE_KEY = 'mll_player_lifetime_announce_v4';

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

function wasSeen(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markSeen(userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), '1');
  } catch {
    /* private mode */
  }
}

/**
 * One-shot announcement: athletes now have a career lifetime (age 18→40 via ROI).
 */
export function PlayerLifetimePopup({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (wasSeen(userId)) return;
    setOpen(true);
  }, [userId]);

  function close() {
    markSeen(userId);
    setOpen(false);
  }

  function goMuseum() {
    close();
    navigate('/club/museum');
  }

  function goSquad() {
    close();
    navigate('/club/vestiario');
  }

  if (!open) return null;

  const retireMult = PLAYER_ROI_RETIRE_MULTIPLIER;
  const roiPct = retireMult * 100;

  return (
    <AnimatePresence>
      <motion.div
        key="player-lifetime-popup"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[205] flex items-center justify-center p-3 sm:p-6"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-lifetime-title"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="pixel-card relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto"
          style={{
            borderColor: 'var(--gold)',
            boxShadow: '0 0 56px rgba(255,200,0,0.3), 0 0 0 1px var(--gold)',
            padding: '1.5rem 1.25rem',
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{
              background: 'linear-gradient(90deg, var(--gold-dark), var(--gold), var(--green))',
            }}
          />

          <button
            type="button"
            onClick={close}
            className="absolute top-3 right-3 retro-text text-xl leading-none z-10"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Fechar"
          >
            <i className="bi bi-x-lg" aria-hidden />
          </button>

          <div className="pt-1">
            <div className="text-center mb-5 sm:mb-6">
              <motion.div
                className="text-5xl sm:text-6xl mb-2"
                initial={{ rotate: -8, scale: 0.7 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.05 }}
              >
                <i className="bi bi-hourglass-split" aria-hidden />
              </motion.div>
              <p
                className="retro-text text-xs sm:text-sm uppercase tracking-widest mb-2"
                style={{ color: 'var(--gold)' }}
              >
                Nova mecânica · atualização da liga
              </p>
              <h2
                id="player-lifetime-title"
                className="pixel-text text-2xl sm:text-3xl md:text-4xl leading-tight px-2"
                style={{ color: 'var(--gold)' }}
              >
                JOGADORES TÊM TEMPO DE VIDA
              </h2>
            </div>

            <p
              className="retro-text text-base sm:text-lg leading-relaxed text-center mb-5 sm:mb-6 px-1 sm:px-4"
              style={{ color: '#f1f5f9' }}
            >
              A partir de agora, atletas do <strong style={{ color: 'var(--gold)' }}>Scout</strong> e do{' '}
              <strong style={{ color: 'var(--gold)' }}>Marketplace</strong> têm uma carreira com idade.
              A idade <strong style={{ color: '#fff' }}>não passa com o tempo real</strong> — ela sobe
              conforme o atleta <strong style={{ color: '#fff' }}>recupera o investimento em USDC</strong>{' '}
              enquanto joga de titular nos Patrocínios.
            </p>

            {/* Journey strip */}
            <div
              className="mb-5 sm:mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {[
                {
                  n: String(PLAYER_CAREER_START_AGE),
                  label: 'Anos ao chegar',
                  detail: '0% de retorno — carreira começa',
                  color: 'var(--green)',
                },
                {
                  n: `${roiPct}%`,
                  label: 'Meta de retorno',
                  detail: `${retireMult}× o custo do atleta em USDC`,
                  color: 'var(--gold)',
                },
                {
                  n: String(PLAYER_CAREER_RETIRE_AGE),
                  label: 'Aposentadoria',
                  detail: 'Sai do elenco ativo → Museu',
                  color: 'var(--purple)',
                },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="text-center px-3 py-4"
                  style={{
                    borderRadius: 12,
                    background: 'rgba(0,0,0,0.5)',
                    border: `1px solid ${cell.color}66`,
                  }}
                >
                  <p className="pixel-text text-3xl sm:text-4xl" style={{ color: cell.color }}>
                    {cell.n}
                  </p>
                  <p className="retro-text text-sm font-semibold mt-2" style={{ color: '#fff' }}>
                    {cell.label}
                  </p>
                  <p className="retro-text text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {cell.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 sm:mb-6">
              <section
                className="text-left px-4 py-4"
                style={{
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <h3 className="pixel-text text-base sm:text-lg mb-3" style={{ color: 'var(--gold)' }}>
                  COMO FUNCIONA
                </h3>
                <ol className="space-y-3">
                  {[
                    'Você compra ou faz Scout de um atleta — esse valor vira o custo base da carreira.',
                    'Coloque-o no XI (titular). Enquanto minerar USDC nos Patrocínios, a idade sobe.',
                    `Quando o atleta já rendeu ${retireMult}× o custo em USDC, chega aos ${PLAYER_CAREER_RETIRE_AGE} anos e vai para o Museu.`,
                    'No Museu ele sai do elenco ativo (não escala mais), mas fica registrado na história do clube.',
                  ].map((line, i) => (
                    <li key={line} className="flex gap-3 retro-text text-sm sm:text-base leading-relaxed" style={{ color: '#e2e8f0' }}>
                      <span
                        className="shrink-0 pixel-text text-sm w-6 h-6 flex items-center justify-center"
                        style={{
                          color: 'var(--bg-dark)',
                          background: 'var(--gold)',
                          borderRadius: 6,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section
                className="text-left px-4 py-4"
                style={{
                  borderRadius: 12,
                  background: 'rgba(168,255,64,0.06)',
                  border: '1px solid rgba(168,255,64,0.35)',
                }}
              >
                <h3 className="pixel-text text-base sm:text-lg mb-3" style={{ color: 'var(--green)' }}>
                  EXEMPLO RÁPIDO
                </h3>
                <p className="retro-text text-sm sm:text-base leading-relaxed mb-3" style={{ color: '#e2e8f0' }}>
                  Scout de um atleta por <strong style={{ color: '#fff' }}>2 GMT</strong> (custo base ≈{' '}
                  <strong style={{ color: '#fff' }}>2 USDC</strong>):
                </p>
                <ul className="space-y-2.5">
                  {[
                    { age: '18', text: 'Acabou de chegar — ainda não rendeu.' },
                    { age: '~29', text: 'Já recuperou o custo (≈ 100% ROI).' },
                    { age: '40', text: `Rendeu ${retireMult * 2} USDC (${roiPct}%) → Museu.` },
                  ].map((row) => (
                    <li key={row.age} className="flex gap-3 items-start">
                      <span className="pixel-text text-sm shrink-0" style={{ color: 'var(--gold)', minWidth: 40 }}>
                        {row.age}
                      </span>
                      <span className="retro-text text-sm sm:text-base" style={{ color: '#e2e8f0' }}>
                        {row.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="retro-text text-xs sm:text-sm mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Scout: você paga ~2 GMT, mas o <strong style={{ color: '#fff' }}>custo de carreira</strong> sobe
                  com a raridade (×5 por tier: comum 2 · raro 10 · SR 50…). Marketplace: preço pago.
                  Fusão <strong style={{ color: '#fff' }}>mantém</strong> o mining dos 5 e soma custo + taxa GMT.
                </p>
              </section>
            </div>

            <div
              className="mb-5 sm:mb-6 px-4 py-3 text-left"
              style={{
                borderRadius: 10,
                background: 'rgba(0,0,0,0.35)',
                border: '1px dashed rgba(255,200,0,0.4)',
              }}
            >
              <p className="retro-text text-sm sm:text-base leading-relaxed" style={{ color: '#f8fafc' }}>
                <strong style={{ color: 'var(--gold)' }}>Importante:</strong> jogadores{' '}
                <strong>grátis</strong> (cadastro) e de <strong>indicação</strong> não entram no ciclo
                de idade. Banco / reserva não envelhecem — só titulares no XI. A idade aparece nos
                cards e no detalhe do jogador.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <button
                type="button"
                className="pixel-btn pixel-btn-gold pixel-btn-md flex-1"
                onClick={goSquad}
              >
                VER ELENCO
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-md flex-1"
                style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
                onClick={goMuseum}
              >
                ABRIR MUSEU
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-md flex-1"
                onClick={close}
                style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
              >
                ENTENDI
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
