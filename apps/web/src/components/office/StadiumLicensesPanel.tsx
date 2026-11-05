import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { stadiumRarityLabel, type StadiumLicenseCatalogItemDTO } from '@mll/shared';
import { useStadiumLicenses, useStadiumLicenseAction } from '../../hooks/useApi';
import { resolveUploadUrl } from '../../lib/resolveUploadUrl';

const fmtUsdc = (n: number) =>
  n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 6 : 2,
  });

const fmtGmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString('pt-BR') : fmtUsdc(n);

function statusLabel(item: StadiumLicenseCatalogItemDTO): { text: string; color: string } {
  if (item.isCurrent) return { text: '● EM USO', color: 'var(--gold)' };
  if (item.licenseStatus === 'signed') return { text: '● LICENCIADO', color: 'var(--green-light)' };
  if (item.licenseStatus === 'purchased') return { text: '◎ AGUARDANDO ASSINATURA', color: 'var(--orange)' };
  return { text: '○ DISPONÍVEL', color: '#ffffff' };
}

function ContractModal({
  item,
  clubName,
  pending,
  onClose,
  onSign,
}: {
  item: StadiumLicenseCatalogItemDTO;
  clubName: string;
  pending: boolean;
  onClose: () => void;
  onSign: () => void;
}) {
  const [stamped, setStamped] = useState(false);
  const price = item.priceUsdc != null && item.priceUsdc > 0 ? fmtGmt(item.priceUsdc) : '0';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.8)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto pixel-card space-y-4"
          style={{
            borderColor: 'var(--gold)',
            background: 'linear-gradient(180deg, #1a1520 0%, #0c1018 100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-1 border-b pb-3" style={{ borderColor: 'rgba(255,200,80,0.35)' }}>
            <p className="retro-text text-sm tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              FEDERAÇÃO MASTER LEGENDS LEAGUE
            </p>
            <h2 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--gold)' }}>
              Contrato de Cessão de Uso do Campo
            </h2>
            <p className="retro-text text-base" style={{ color: '#ffffff' }}>
              Licença de Uso · v1
            </p>
          </div>

          <div className="retro-text text-base leading-relaxed space-y-3" style={{ color: '#ffffff' }}>
            <p>
              O clube <strong style={{ color: 'var(--gold)' }}>{clubName}</strong> adquire a licença
              de uso do campo <strong style={{ color: 'var(--gold-light)' }}>{item.name}</strong> perante a
              Federação MLL.
            </p>
            <ul className="space-y-1.5 pl-1">
              <li>· Valor da licença: <strong style={{ color: 'var(--gold)' }}>{price} GMT</strong></li>
              <li>· Bônus de farm: <strong style={{ color: 'var(--green-light)' }}>+{Math.round(item.farmBonusPct * 100)}%</strong></li>
              <li>· Slots: <strong>{item.slotCount}</strong></li>
              <li>· Uso exclusivo enquanto o contrato estiver ativo no Escritório</li>
            </ul>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Ao assinar, o presidente do clube confirma a cessão e autoriza a ativação do campo no
              Estádio.
            </p>
          </div>

          <div className="relative flex items-center justify-center py-6">
            <div
              className="pixel-box-light px-6 py-4 text-center min-w-[200px]"
              style={{ borderColor: stamped ? 'var(--green)' : 'rgba(255,255,255,0.15)' }}
            >
              <p className="retro-text text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Carimbo do clube</p>
              <motion.div
                animate={stamped ? { scale: [1.4, 1], rotate: [-12, 0] } : {}}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="pixel-text text-3xl"
                style={{ color: stamped ? 'var(--green-light)' : '#a8b4c4' }}
              >
                {stamped ? <i className="bi bi-check-lg" aria-hidden /> : '◎'}
              </motion.div>
              <p className="retro-text text-base mt-1" style={{ color: stamped ? 'var(--green-light)' : '#ffffff' }}>
                {stamped ? 'ASSINADO' : 'PENDENTE'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="pixel-btn pixel-btn-md flex-1"
              style={{
                borderColor: 'rgba(148,163,184,0.55)',
                background: 'rgba(15,23,42,0.85)',
                color: '#e2e8f0',
              }}
              onClick={onClose}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-gold pixel-btn-md flex-1 disabled:opacity-50"
              disabled={pending}
              onClick={() => {
                setStamped(true);
                window.setTimeout(() => onSign(), 450);
              }}
            >
              {pending ? 'Assinando…' : 'Assinar e carimbar'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function StadiumLicensesPanel() {
  const { data, isLoading, isError, refetch } = useStadiumLicenses();
  const action = useStadiumLicenseAction();
  const [signItem, setSignItem] = useState<StadiumLicenseCatalogItemDTO | null>(null);
  const [error, setError] = useState('');

  const run = async (templateId: string, kind: 'buy' | 'sign' | 'activate') => {
    setError('');
    try {
      await action.mutateAsync({ templateId, action: kind });
      if (kind === 'sign') setSignItem(null);
    } catch (err) {
      const axiosData = (err as { response?: { data?: { error?: { code?: string } } } })?.response
        ?.data;
      const code = axiosData?.error?.code ?? '';
      if (code === 'STADIUM_LICENSE_RARE_TEAM_REQUIRED') {
        setError('Upgrade bloqueado: o elenco completo dessa raridade ainda não está no clube.');
      } else {
        setError('Não foi possível concluir. Verifique saldo GMT, requisitos do elenco e tente de novo.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="pixel-card text-center py-8" style={{ borderColor: 'var(--gold)' }}>
        <p className="retro-text text-base" style={{ color: '#ffffff' }}>Carregando licenças…</p>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="pixel-card space-y-3 text-center py-8" style={{ borderColor: 'var(--gold)' }}>
        <h2 className="pixel-text text-xl" style={{ color: 'var(--gold)' }}>
          Licenças de Campo
        </h2>
        <p className="retro-text" style={{ color: 'var(--red)' }}>
          Não foi possível carregar as licenças de estádio.
        </p>
        <button
          type="button"
          className="pixel-btn pixel-btn-md"
          style={{ borderColor: 'var(--gold)', color: '#fff' }}
          onClick={() => void refetch()}
        >
          TENTAR DE NOVO
        </button>
      </div>
    );
  }

  return (
    <>
      {signItem && (
        <ContractModal
          item={signItem}
          clubName={data.clubName}
          pending={action.isPending}
          onClose={() => setSignItem(null)}
          onSign={() => void run(signItem.templateId, 'sign')}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pixel-card space-y-4"
        style={{ borderColor: 'var(--gold)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="pixel-text text-xl sm:text-2xl" style={{ color: 'var(--gold)' }}>
              Licenças de Campo
            </h2>
            <p className="retro-text text-base mt-2 leading-relaxed" style={{ color: '#ffffff' }}>
              Cada estádio custa o próprio percentual em GMT. Comum não libera campo. Um elenco de{' '}
              {data.rareStartersRequired} <strong style={{ color: 'var(--gold)' }}>Incomum</strong> libera
              o primeiro, {data.rareStartersRequired} Raro o seguinte, e assim por diante.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="pixel-box-light px-4 py-3 text-center min-w-[120px]">
              <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>Saldo GMT</p>
              <p className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
                {fmtUsdc(data.gmtBalance)}
              </p>
            </div>
            <div
              className="pixel-box-light px-4 py-3 text-center min-w-[140px]"
              style={{
                borderColor: data.meetsRareTeamRequirement ? 'var(--green)' : 'var(--orange)',
              }}
            >
              <p className="retro-text text-base" style={{ color: 'var(--text-secondary)' }}>Elenco Incomum+</p>
              <p
                className="pixel-text text-lg"
                style={{
                  color: data.meetsRareTeamRequirement ? 'var(--green-light)' : 'var(--orange)',
                }}
              >
                {data.rareStartersCount}/{data.rareStartersRequired}
              </p>
            </div>
          </div>
        </div>

        {!data.meetsRareTeamRequirement && (
          <p
            className="retro-text text-base px-3 py-2"
            style={{
              color: '#ffe4c4',
              background: 'rgba(232,152,72,0.2)',
              border: '1px solid var(--orange)',
            }}
          >
            Faltam {Math.max(0, data.rareStartersRequired - data.rareStartersCount)} jogador(es)
            Incomum ou superior para liberar o primeiro estádio. Comum não conta.
          </p>
        )}

        {error && (
          <p className="retro-text text-base" style={{ color: 'var(--red-light)' }}>{error}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.items.map((item) => {
            const st = statusLabel(item);
            const meets = item.meetsRequirements ?? true;
            const canBuy =
              !item.isFree &&
              item.licenseStatus == null &&
              meets;
            const blockedByReqs =
              !item.isFree &&
              item.licenseStatus == null &&
              !meets;
            const canSign = item.licenseStatus === 'purchased';
            const canActivate =
              item.licenseStatus === 'signed' &&
              !item.isCurrent &&
              (item.isFree || meets);
            const img = item.imageUrl ? resolveUploadUrl(item.imageUrl) : null;
            const blockers = item.requirementBlockers ?? [];

            return (
              <div
                key={item.templateId}
                className="pixel-box-light overflow-hidden flex flex-col"
                style={{ borderColor: item.isCurrent ? 'var(--gold)' : 'rgba(255,255,255,0.22)' }}
              >
                <div className="relative aspect-[16/9] bg-black/40">
                  {img ? (
                    <img
                      src={img}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center pixel-text text-4xl" style={{ color: '#c4c4c4' }}>
                      <i className="bi bi-building" aria-hidden />
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 ui-label-sm px-2 py-1"
                    style={{
                      background: 'rgba(0,0,0,0.82)',
                      color: st.color,
                      borderRadius: 2,
                      border: `1px solid ${st.color}`,
                    }}
                  >
                    {st.text}
                  </span>
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <h3 className="pixel-text text-lg" style={{ color: '#ffffff' }}>{item.name}</h3>
                    <p className="retro-text text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {item.isFree || !item.priceUsdc
                        ? 'Grátis'
                        : `${fmtGmt(item.priceUsdc)} GMT`}
                      {' · '}
                      <span style={{ color: 'var(--green-light)' }}>
                        +{Math.round(item.farmBonusPct * 100)}% farm
                      </span>
                      {' · '}
                      {item.slotCount} slots
                    </p>
                    {!item.isFree && (
                      <div
                        className="mt-3 space-y-1.5 rounded border px-3 py-2"
                        style={{
                          borderColor: meets
                            ? 'color-mix(in srgb, var(--green) 40%, transparent)'
                            : 'color-mix(in srgb, var(--orange, #fb923c) 45%, transparent)',
                          background: meets ? 'rgba(52,211,153,0.06)' : 'rgba(251,146,60,0.08)',
                        }}
                      >
                        <p
                          className="ui-label-sm"
                          style={{ color: meets ? 'var(--green-light)' : 'var(--orange, #fb923c)' }}
                        >
                          {meets ? 'Requisitos OK' : 'Requisitos'}
                        </p>
                        {(item.requireRareStarters ?? 0) > 0 && (
                          <p className="retro-text text-sm" style={{ color: 'var(--text-primary)' }}>
                            {(item.squadCount ?? 0) >= (item.requireRareStarters ?? 0) ? <i className="bi bi-check-lg" aria-hidden /> : '○'}{' '}
                            {item.requireRareStarters} jogadores {stadiumRarityLabel(item.requireMinRarity ?? 1)} ou superior
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}
                              ({item.squadCount ?? 0}/{item.requireRareStarters})
                            </span>
                          </p>
                        )}
                        {(item.requireMinOverwall ?? 0) > 0 && (
                          <p className="retro-text text-sm" style={{ color: 'var(--text-primary)' }}>
                            {(data.currentOverwall ?? 0) >= (item.requireMinOverwall ?? 0) ? <i className="bi bi-check-lg" aria-hidden /> : '○'}{' '}
                            Overwall mínimo {item.requireMinOverwall!.toLocaleString('pt-BR')}
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}
                              (seu: {(data.currentOverwall ?? 0).toLocaleString('pt-BR')})
                            </span>
                          </p>
                        )}
                        {item.requireOwnedTemplateName && (
                          <p className="retro-text text-sm" style={{ color: 'var(--text-primary)' }}>
                            {!blockers.some(
                              (b) =>
                                b.includes('Precisa da licença') ||
                                b.includes('campo licenciado'),
                            )
                              ? 'bi-check-lg'
                              : '○'}{' '}
                            Licença prévia: {item.requireOwnedTemplateName}
                          </p>
                        )}
                        {item.requirementNote && (
                          <p className="retro-text text-sm" style={{ color: 'var(--gold)' }}>
                            <i className="bi bi-chat-fill" aria-hidden /> {item.requirementNote}
                          </p>
                        )}
                        {(item.requireRareStarters ?? 0) <= 0 &&
                          (item.requireMinOverwall ?? 0) <= 0 &&
                          !item.requireOwnedTemplateName &&
                          !item.requirementNote && (
                            <p className="retro-text text-sm" style={{ color: 'var(--text-muted)' }}>
                              Sem requisitos extras
                            </p>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    {blockedByReqs && (
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-md w-full whitespace-normal leading-tight"
                        style={{
                          borderColor: 'var(--orange, #fb923c)',
                          background: 'rgba(251,146,60,0.18)',
                          color: '#fed7aa',
                          height: 'auto',
                          minHeight: 'var(--app-btn-h-md)',
                          padding: '10px 12px',
                        }}
                        disabled
                      >
                        {blockers.length > 0
                          ? blockers.join(' · ')
                          : 'REQUISITOS NÃO ATENDIDOS'}
                      </button>
                    )}
                    {canBuy && (
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-gold pixel-btn-md w-full whitespace-normal leading-tight disabled:opacity-50"
                        style={{ height: 'auto', minHeight: 'var(--app-btn-h-md)', padding: '10px 12px' }}
                        disabled={action.isPending || data.gmtBalance < (item.priceUsdc ?? 0)}
                        onClick={() => void run(item.templateId, 'buy')}
                      >
                        {data.gmtBalance < (item.priceUsdc ?? 0)
                          ? 'SALDO INSUFICIENTE'
                          : `COMPRAR · ${fmtGmt(item.priceUsdc ?? 0)} GMT`}
                      </button>
                    )}
                    {canSign && (
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-green pixel-btn-md w-full"
                        disabled={action.isPending}
                        onClick={() => setSignItem(item)}
                      >
                        ASSINAR CONTRATO
                      </button>
                    )}
                    {canActivate && (
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-blue pixel-btn-md w-full"
                        disabled={action.isPending}
                        onClick={() => void run(item.templateId, 'activate')}
                      >
                        ATIVAR CAMPO
                      </button>
                    )}
                    {item.licenseStatus === 'signed' &&
                      !item.isCurrent &&
                      !item.isFree &&
                      !meets && (
                      <button
                        type="button"
                        className="pixel-btn pixel-btn-md w-full whitespace-normal leading-tight"
                        style={{
                          borderColor: 'var(--orange, #fb923c)',
                          background: 'rgba(251,146,60,0.18)',
                          color: '#fed7aa',
                          height: 'auto',
                          minHeight: 'var(--app-btn-h-md)',
                          padding: '10px 12px',
                        }}
                        disabled
                      >
                        {blockers.length > 0
                          ? `ATIVAÇÃO BLOQUEADA · ${blockers.join(' · ')}`
                          : 'ATIVAÇÃO BLOQUEADA'}
                      </button>
                    )}
                    {item.isCurrent && (
                      <Link
                        to="/club/stadium"
                        className="pixel-btn pixel-btn-md w-full text-center"
                        style={{
                          borderColor: 'var(--blue)',
                          background: 'rgba(56,189,248,0.12)',
                          color: '#7dd3fc',
                        }}
                      >
                        ABRIR ESTÁDIO →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {data.items.length === 0 && (
          <p className="retro-text text-base text-center py-6" style={{ color: 'var(--text-secondary)' }}>
            Nenhum estádio ativo no catálogo.
          </p>
        )}
      </motion.div>
    </>
  );
}
