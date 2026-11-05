import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlayerProfileDTO } from '@mll/shared';
import { usePlayerProfile } from '../../../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { PageContentShell } from '../../../components/content';
import { apiClient } from '../../../lib/api/client';
import { formatUsdcAmount } from '../../../lib/formatUsdc';
import { translateError } from '../../../lib/apiError';
import { resolveUploadUrl } from '../../../lib/resolveUploadUrl';

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function shortWallet(wallet: string | null): string {
  if (!wallet) return 'Sem carteira';
  if (wallet.length < 12) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function resultLabel(result: 'win' | 'loss' | 'draw'): string {
  if (result === 'win') return 'Vitória';
  if (result === 'draw') return 'Empate';
  return 'Derrota';
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = usePlayerProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubEditing, setClubEditing] = useState(false);
  const [clubBusy, setClubBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk] = useState('');

  const applyProfile = (next: PlayerProfileDTO) => {
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: ['club'] });
    queryClient.setQueriesData({ queryKey: ['profile'] }, next);
  };

  const uploadAvatar = async (file: File) => {
    setFormErr('');
    setFormOk('');
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data: next } = await apiClient.post<PlayerProfileDTO>('/api/profile/avatar', fd);
      applyProfile(next);
      setFormOk('Avatar atualizado.');
    } catch (err: unknown) {
      setFormErr(translateError(err));
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearAvatar = async () => {
    setFormErr('');
    setFormOk('');
    setAvatarBusy(true);
    try {
      const { data: next } = await apiClient.delete<PlayerProfileDTO>('/api/profile/avatar');
      applyProfile(next);
      setFormOk('Avatar removido.');
    } catch (err: unknown) {
      setFormErr(translateError(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveClubName = async () => {
    setFormErr('');
    setFormOk('');
    setClubBusy(true);
    try {
      const { data: next } = await apiClient.patch<PlayerProfileDTO>('/api/profile/club-name', {
        name: clubName.trim(),
      });
      applyProfile(next);
      setClubEditing(false);
      setFormOk('Nome do clube atualizado.');
    } catch (err: unknown) {
      setFormErr(translateError(err));
    } finally {
      setClubBusy(false);
    }
  };

  if (isLoading) {
    return (
      <PageContentShell>
        <div className="pixel-card text-center py-16">
          <p className="retro-text text-xl">Carregando perfil…</p>
        </div>
      </PageContentShell>
    );
  }

  if (isError || !data) {
    return (
      <PageContentShell>
        <div className="pixel-card text-center py-8" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text mb-4">{translateError(error, 'CLUB_LOAD_FAILED')}</p>
          <button type="button" onClick={() => void refetch()} className="pixel-btn pixel-btn-blue pixel-btn-md">
            Tentar de novo
          </button>
        </div>
      </PageContentShell>
    );
  }

  const { account, club, players, finance, gameplay } = data;
  const avatarSrc = account.avatarUrl ? resolveUploadUrl(account.avatarUrl) : null;

  return (
    <PageContentShell>
      <div className="space-y-4">
        {(formErr || formOk) && (
          <p className="retro-text text-center" style={{ color: formErr ? 'var(--red)' : 'var(--green)' }}>
            {formErr || formOk}
          </p>
        )}

        <section className="pixel-card" style={{ borderColor: '#4338ca' }}>
          <h2 className="ui-label-sm mb-3" style={{ color: '#a5b4fc' }}>Dados de conta</h2>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden text-xl font-extrabold text-white"
                style={{ background: '#4338ca', borderRadius: 8 }}
                aria-hidden
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  account.avatarInitials
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="pixel-text text-xl text-white">{account.name ?? 'Sem nome'}</p>
              <p className="retro-text text-sm break-all" style={{ color: 'var(--text-muted)' }}>ID {account.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
                <button
                  type="button"
                  className="pixel-btn pixel-btn-sm"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarBusy ? '…' : 'Mudar avatar'}
                </button>
                {avatarSrc ? (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-sm pixel-btn-red"
                    disabled={avatarBusy}
                    onClick={() => void clearAvatar()}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="ui-label-sm">Carteira Web3</dt>
              <dd className="retro-text break-all">{shortWallet(account.wallet)}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Criada em</dt>
              <dd className="retro-text">{when(account.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="pixel-card" style={{ borderColor: '#15803d' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="ui-label-sm" style={{ color: '#86efac' }}>Dados do clube</h2>
            {!clubEditing ? (
              <button
                type="button"
                className="pixel-btn pixel-btn-sm"
                onClick={() => {
                  setClubName(club.name);
                  setClubEditing(true);
                }}
              >
                Renomear
              </button>
            ) : null}
          </div>
          {clubEditing ? (
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="pixel-input min-w-[12rem] flex-1"
                maxLength={32}
                aria-label="Nome do clube"
              />
              <button
                type="button"
                className="pixel-btn pixel-btn-sm pixel-btn-green"
                disabled={clubBusy || clubName.trim().length < 3}
                onClick={() => void saveClubName()}
              >
                {clubBusy ? '…' : 'Salvar'}
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-sm"
                disabled={clubBusy}
                onClick={() => setClubEditing(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <p className="pixel-text text-xl text-white">{club.name}</p>
          )}
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="ui-label-sm">Nível</dt>
              <dd className="retro-text">{club.stadiumLvl}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">OVERWALL do elenco</dt>
              <dd className="retro-text">{club.squadOverwall.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">OVERWALL ativo</dt>
              <dd className="retro-text">{club.activeOverwall.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">OVERWALL total</dt>
              <dd className="retro-text">{club.collectionOverwall.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Clube criado</dt>
              <dd className="retro-text">{when(club.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="pixel-card" style={{ borderColor: '#1d4ed8' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ui-label-sm" style={{ color: '#93c5fd' }}>Dados dos jogadores</h2>
            <div className="flex gap-2">
              <Link to="/club/vestiario" className="pixel-btn pixel-btn-md">Elenco</Link>
              <Link to="/club/inventory" className="pixel-btn pixel-btn-md">Inventário</Link>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="ui-label-sm">Personagens</dt>
              <dd className="retro-text">{players.baseCount + players.nftCount}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Escalados</dt>
              <dd className="retro-text">{players.lineupCount}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Itens</dt>
              <dd className="retro-text">{players.inventoryCount}</dd>
            </div>
          </dl>
          {players.lineup.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {players.lineup.map((player) => (
                <li key={player.id} className="retro-text flex justify-between gap-3">
                  <span>{player.name} · {player.position}</span>
                  <span>OW {player.overwall}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="retro-text mt-3" style={{ color: 'var(--text-muted)' }}>Nenhum jogador escalado.</p>
          )}
        </section>

        <section className="pixel-card" style={{ borderColor: '#c2410c' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ui-label-sm" style={{ color: '#fdba74' }}>Dados financeiros</h2>
            <Link to="/wallet" className="pixel-btn pixel-btn-md">Carteira</Link>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="ui-label-sm">GMT</dt>
              <dd className="retro-text">{formatUsdcAmount(finance.gmt, 2)}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">USDC</dt>
              <dd className="retro-text">{formatUsdcAmount(finance.usdc, 2)}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">USDT</dt>
              <dd className="retro-text">{formatUsdcAmount(finance.usdt, 2)}</dd>
            </div>
          </dl>
          {finance.transactions.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {finance.transactions.map((tx) => (
                <li key={`${tx.source}-${tx.id}`} className="retro-text flex justify-between gap-3">
                  <span>{tx.type}</span>
                  <span>{formatUsdcAmount(tx.amount, 2)} · {when(tx.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="retro-text mt-3" style={{ color: 'var(--text-muted)' }}>Sem transações recentes.</p>
          )}
        </section>

        <section className="pixel-card" style={{ borderColor: '#be123c' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ui-label-sm" style={{ color: '#fda4af' }}>Dados de gameplay</h2>
            <div className="flex flex-wrap gap-2">
              <Link to="/pass" className="pixel-btn pixel-btn-md">Passe</Link>
              <Link to="/pvp" className="pixel-btn pixel-btn-md">PVP</Link>
              <Link to="/ranking" className="pixel-btn pixel-btn-md">Tabela</Link>
              <Link to="/club/museum" className="pixel-btn pixel-btn-md">Museu</Link>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <dt className="ui-label-sm">Temporada</dt>
              <dd className="retro-text">{gameplay.seasonActive ? (gameplay.seasonName ?? 'Ativa') : 'Sem temporada'}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Progresso</dt>
              <dd className="retro-text">Nível {gameplay.passLevel} · {gameplay.passXp} XP{gameplay.passPremium ? ' · Premium' : ''}</dd>
            </div>
            <div>
              <dt className="ui-label-sm">Conquistas</dt>
              <dd className="retro-text">{gameplay.trophyCount} troféus · {gameplay.badgeCount} badges</dd>
            </div>
          </dl>
          {gameplay.matches.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {gameplay.matches.map((match) => (
                <li key={match.id} className="retro-text flex justify-between gap-3">
                  <span>vs {match.opponent}</span>
                  <span>{resultLabel(match.result)} · {when(match.playedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="retro-text mt-3" style={{ color: 'var(--text-muted)' }}>Sem partidas recentes.</p>
          )}
        </section>
      </div>
    </PageContentShell>
  );
}
