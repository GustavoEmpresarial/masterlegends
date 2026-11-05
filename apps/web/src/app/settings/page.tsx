import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthUserDTO } from '@mll/shared';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api/client';
import { PageContentShell, PageHero } from '../../components/content';
import { requestTutorialReplay } from '../../components/onboarding/OnboardingTutorial';
import { isAudioMuted, playUiBlip, setAudioMuted } from '../../lib/audioPref';

const LANGUAGES = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const { t, i18n } = useTranslation(['club', 'common']);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdOk, setPwdOk] = useState(true);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [unameMsg, setUnameMsg] = useState('');
  const [unameOk, setUnameOk] = useState(true);
  const [unameSaving, setUnameSaving] = useState(false);

  const [muted, setMuted] = useState(() => isAudioMuted());
  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(true);
  const [resending, setResending] = useState(false);

  async function submitUsername() {
    setUnameMsg('');
    setUnameOk(true);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
      setUnameOk(false);
      setUnameMsg('Username inválido (3-20 caracteres, letras/números/underscore)');
      return;
    }
    setUnameSaving(true);
    try {
      await apiClient.post('/auth/change-username', { username: newUsername });
      setUnameMsg('Username alterado. Faça login novamente se necessário.');
      setNewUsername('');
      await refreshUser();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = anyErr?.response?.data?.error?.code;
      setUnameOk(false);
      setUnameMsg(
        code === 'AUTH_EMAIL_OR_USERNAME_TAKEN'
          ? 'Username já está em uso'
          : anyErr?.response?.data?.error?.message ?? 'Falha ao alterar',
      );
    } finally {
      setUnameSaving(false);
    }
  }

  async function submitPassword() {
    setPwdMsg('');
    setPwdOk(true);
    if (newPassword !== newPasswordConfirm) {
      setPwdOk(false);
      setPwdMsg('Senhas não conferem');
      return;
    }
    setPwdSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPwdMsg('Senha alterada');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
      setPwdOk(false);
      setPwdMsg(anyErr?.response?.data?.error?.message ?? 'Falha ao alterar senha');
    } finally {
      setPwdSaving(false);
    }
  }

  function changeLanguage(code: string) {
    void i18n.changeLanguage(code);
    try {
      localStorage.setItem('lng', code);
    } catch {
      /* ignore */
    }
  }

  return (
    <PageContentShell className="settings-page w-full min-w-0">
      <PageHero
        title={<><i className="bi bi-gear-fill" aria-hidden /> Configurações</>}
        subtitle="Conta, alertas, segurança e idioma — tudo em um só lugar."
        titleColor="var(--gold)"
        align="left"
      />

      <div className="flex flex-col gap-4 sm:gap-5 min-w-0 w-full">
        {/* Perfil */}
        <Section title="Perfil" borderColor="var(--gold)" hint="Dados da sua conta no Master Legends League.">
          <InfoPanel accent="var(--gold)">
            <InfoRow label="Username" value={user?.username ?? '—'} />
            <InfoRow
              label="Email"
              value={user?.email ?? '—'}
              note="Não editável"
              trailing={
                user?.emailVerified ? (
                  <span className="pixel-badge pixel-badge--green shrink-0">Confirmado</span>
                ) : (
                  <span className="pixel-badge pixel-badge--orange shrink-0">Pendente</span>
                )
              }
            />
            <InfoRow
              label="Carteira"
              value={user?.wallet ?? 'Não conectada'}
              mono
              empty={!user?.wallet}
            />
            <InfoRow label="Referral" value={user?.referralCode ?? '—'} mono />
          </InfoPanel>
        </Section>

        {/* E-mail e tutorial */}
        <Section
          title="E-mail e tutorial"
          borderColor="var(--orange)"
          hint="Confirme o e-mail da conta e reveja o guia inicial quando quiser."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              className="pixel-btn pixel-btn-md w-full"
              style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
              disabled={resending || !!user?.emailVerified}
              onClick={() => {
                void (async () => {
                  setResending(true);
                  setResendMsg('');
                  setResendOk(true);
                  try {
                    const { data } = await apiClient.post<{ ok: true; alreadyVerified?: boolean }>(
                      '/auth/resend-verification',
                    );
                    if (data.alreadyVerified) {
                      await refreshUser();
                      setResendMsg(t('club:tutorial.email.alreadyVerified'));
                    } else {
                      setResendMsg(t('club:tutorial.email.resent'));
                    }
                  } catch (err: unknown) {
                    const anyErr = err as { response?: { data?: { error?: { message?: string } } } };
                    setResendOk(false);
                    setResendMsg(anyErr?.response?.data?.error?.message ?? 'Falha ao reenviar e-mail.');
                  } finally {
                    setResending(false);
                  }
                })();
              }}
            >
              {resending
                ? t('club:tutorial.email.resending')
                : user?.emailVerified
                  ? t('club:tutorial.email.verified')
                  : t('club:tutorial.email.resend')}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-gold pixel-btn-md w-full"
              onClick={() => requestTutorialReplay()}
            >
              {t('club:tutorial.replay')}
            </button>
          </div>
          {resendMsg && <Feedback ok={resendOk}>{resendMsg}</Feedback>}
        </Section>

        <TelegramSettingsSection refreshUser={refreshUser} user={user} />

        {/* Username */}
        <Section
          title="Alterar username"
          borderColor="var(--green)"
          hint="3–20 caracteres · letras, números e underscore · único na plataforma."
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitUsername();
            }}
          >
            <FormField label="Novo username">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={user?.username ?? ''}
                className="pixel-input w-full"
                maxLength={20}
                autoComplete="username"
              />
            </FormField>
            <button
              type="submit"
              disabled={unameSaving || !newUsername}
              className="pixel-btn pixel-btn-green pixel-btn-md w-full sm:w-auto disabled:opacity-50"
            >
              {unameSaving ? 'Alterando...' : 'Alterar username'}
            </button>
            {unameMsg && <Feedback ok={unameOk}>{unameMsg}</Feedback>}
          </form>
        </Section>

        {/* Senha */}
        <Section title="Alterar senha" borderColor="var(--blue)" hint="Use uma senha forte que você não reuse em outros sites.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPassword();
            }}
          >
            <FormField label="Senha atual">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pixel-input w-full"
                autoComplete="current-password"
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nova senha">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pixel-input w-full"
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Confirmar nova senha">
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="pixel-input w-full"
                  autoComplete="new-password"
                />
              </FormField>
            </div>
            <button
              type="submit"
              disabled={pwdSaving || !currentPassword || !newPassword}
              className="pixel-btn pixel-btn-blue pixel-btn-md w-full sm:w-auto disabled:opacity-50"
            >
              {pwdSaving ? 'Alterando...' : 'Alterar senha'}
            </button>
            {pwdMsg && <Feedback ok={pwdOk}>{pwdMsg}</Feedback>}
          </form>
        </Section>

        {/* Idioma */}
        <Section title="Idioma" borderColor="var(--cyan)" hint="Escolha o idioma da interface.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {LANGUAGES.map((l) => {
              const active = i18n.language?.startsWith(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => changeLanguage(l.code)}
                  className={`pixel-btn pixel-btn-md w-full ${active ? 'pixel-btn-green' : ''}`}
                  style={
                    active
                      ? undefined
                      : {
                          background: 'var(--bg-dark)',
                          borderColor: 'var(--bg-lighter)',
                          color: 'var(--text-primary)',
                        }
                  }
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Áudio" borderColor="var(--gold)" hint="Som do console. Mudo silencia os cliques do menu.">
          <button
            type="button"
            className={`pixel-btn pixel-btn-md w-full sm:w-auto ${muted ? '' : 'pixel-btn-green'}`}
            onClick={() => {
              const next = !muted;
              setAudioMuted(next);
              setMuted(next);
              if (!next) playUiBlip();
            }}
          >
            {muted ? 'SOM DESLIGADO' : 'SOM LIGADO'}
          </button>
        </Section>

        {/* Sessão */}
        <Section title="Sessão" borderColor="var(--red)" hint="Encerra o login neste dispositivo.">
          <button
            type="button"
            onClick={() => void logout()}
            className="pixel-btn pixel-btn-md pixel-btn-red w-full sm:w-auto"
          >
            Sair desta conta
          </button>
        </Section>
      </div>
    </PageContentShell>
  );
}

/* ── shared settings UI (pixel) ─────────────────────────────── */

function Section({
  title,
  borderColor,
  hint,
  children,
}: {
  title: string;
  borderColor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="pixel-card pixel-card-fluid w-full min-w-0" style={{ borderColor }}>
      <div className="flex flex-col gap-1 mb-4 sm:mb-5">
        <h2 className="pixel-text text-base sm:text-lg" style={{ color: borderColor }}>
          {title}
        </h2>
        {hint && (
          <p className="retro-text text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function InfoPanel({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <div
      className="flex flex-col w-full min-w-0 px-3 sm:px-4"
      style={{
        background: 'rgba(0,0,0,0.28)',
        border: '2px solid var(--bg-dark)',
        boxShadow: accent ? `inset 0 0 0 1px ${accent}33` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  note,
  mono,
  empty,
  trailing,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  mono?: boolean;
  empty?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 py-3.5 border-b last:border-b-0 sm:flex-row sm:items-start sm:gap-4 min-w-0 w-full"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-baseline justify-between gap-2 sm:w-36 sm:shrink-0 sm:pt-0.5">
        <span className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        {note && (
          <span className="retro-text text-xs shrink-0 sm:hidden" style={{ color: 'var(--text-muted)' }}>
            {note}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {typeof value === 'string' || typeof value === 'number' ? (
          <span
            className={`min-w-0 break-all leading-snug ${
              mono ? 'font-mono text-sm sm:text-base' : 'text-base sm:text-lg font-medium'
            }`}
            style={{ color: empty ? 'var(--text-muted)' : 'var(--text-primary)' }}
          >
            {value}
          </span>
        ) : (
          <div className="min-w-0">{value}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {note && (
            <span className="retro-text text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
              {note}
            </span>
          )}
          {trailing}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 min-w-0">
      <span className="ui-label-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Feedback({ children, ok = true }: { children: ReactNode; ok?: boolean }) {
  const color = ok ? 'var(--green)' : 'var(--red)';
  return (
    <p
      className="retro-text text-sm sm:text-base leading-relaxed px-3 py-2"
      style={{
        color,
        background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        border: `2px solid ${ok ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
      }}
    >
      {children}
    </p>
  );
}

interface TelegramStatus {
  enabled: boolean;
  botUsername: string | null;
  linked: boolean;
  linkedAt: string | null;
  notifyEnabled: boolean;
}

function TelegramSettingsSection({
  user,
  refreshUser,
}: {
  user: AuthUserDTO | null;
  refreshUser: () => Promise<void>;
}) {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    try {
      const { data } = await apiClient.get<TelegramStatus>('/api/telegram/status');
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [user?.id, user?.telegramLinked]);

  async function link() {
    setBusy(true);
    setMsg('');
    setMsgOk(true);
    try {
      const { data } = await apiClient.post<{ code: string; deepLink: string | null }>(
        '/api/telegram/link',
      );
      if (data.deepLink) {
        window.open(data.deepLink, '_blank', 'noopener,noreferrer');
        setMsg(
          t('telegram.linkOpened', {
            defaultValue: 'Abra o Telegram e confirme /start. Depois atualize esta página.',
          }),
        );
      } else if (data.code) {
        setMsg(
          t('telegram.linkCode', {
            defaultValue: 'No bot, envie: /start {{code}}',
            code: data.code,
          }),
        );
      }
    } catch {
      setMsgOk(false);
      setMsg(t('telegram.linkError', { defaultValue: 'Telegram indisponível no momento.' }));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setMsg('');
    setMsgOk(true);
    try {
      await apiClient.delete('/api/telegram/unlink');
      await refreshUser();
      await loadStatus();
      setMsg(t('telegram.unlinked', { defaultValue: 'Telegram desvinculado.' }));
    } catch {
      setMsgOk(false);
      setMsg(t('telegram.unlinkError', { defaultValue: 'Falha ao desvincular.' }));
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotify(enabled: boolean) {
    setBusy(true);
    try {
      await apiClient.patch('/api/telegram/prefs', { notifyEnabled: enabled });
      await refreshUser();
      await loadStatus();
    } catch {
      setMsgOk(false);
      setMsg(t('telegram.prefsError', { defaultValue: 'Falha ao salvar preferência.' }));
    } finally {
      setBusy(false);
    }
  }

  const linked = status?.linked ?? user?.telegramLinked ?? false;
  const botOff = status != null && !status.enabled;
  const alertsOn = status?.notifyEnabled ?? true;
  const botHandle = status?.botUsername ? `@${status.botUsername.replace(/^@/, '')}` : null;
  const linkedAtLabel = status?.linkedAt
    ? new Date(status.linkedAt).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  const statusBadge = botOff
    ? { label: t('telegram.disabled', { defaultValue: 'Bot desligado' }), cls: 'pixel-badge--muted' }
    : linked
      ? { label: t('telegram.linked', { defaultValue: 'Vinculado' }), cls: 'pixel-badge--green' }
      : { label: t('telegram.notLinked', { defaultValue: 'Não vinculado' }), cls: 'pixel-badge--orange' };

  return (
    <Section
      title={t('telegram.title', { defaultValue: 'Telegram · Genesis DAO' })}
      borderColor="var(--blue)"
      hint={t('telegram.hint', {
        defaultValue:
          'Receba alertas de saque, suporte e eventos do treinador/tesoureiro no Telegram. No bot: /status, /mute, /unmute, /help.',
      })}
    >
      <div className="flex flex-col gap-4 min-w-0 w-full">
        <InfoPanel accent="var(--blue)">
          <InfoRow
            label={t('telegram.status', { defaultValue: 'Status' })}
            value={<span className={`pixel-badge ${statusBadge.cls}`}>{statusBadge.label}</span>}
            trailing={
              <span
                className={`pixel-badge ${
                  !linked || botOff
                    ? 'pixel-badge--muted'
                    : alertsOn
                      ? 'pixel-badge--blue'
                      : 'pixel-badge--orange'
                }`}
              >
                {!linked || botOff
                  ? t('telegram.alertsUnavailable', { defaultValue: 'Alertas indisponíveis' })
                  : alertsOn
                    ? t('telegram.alertsOn', { defaultValue: 'Alertas ativos' })
                    : t('telegram.alertsOff', { defaultValue: 'Alertas pausados' })}
              </span>
            }
          />
          {botHandle && (
            <InfoRow label={t('telegram.bot', { defaultValue: 'Bot' })} value={botHandle} mono />
          )}
          {linked && linkedAtLabel && (
            <InfoRow
              label={t('telegram.linkedSince', { defaultValue: 'Vinculado em' })}
              value={linkedAtLabel}
            />
          )}
        </InfoPanel>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {!linked ? (
            <button
              type="button"
              className="pixel-btn pixel-btn-blue pixel-btn-md w-full sm:col-span-2 lg:col-span-1"
              disabled={busy || botOff}
              onClick={() => void link()}
            >
              {t('telegram.link', { defaultValue: 'Vincular Telegram' })}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`pixel-btn pixel-btn-md w-full ${alertsOn ? '' : 'pixel-btn-blue'}`}
                disabled={busy || botOff}
                onClick={() => void toggleNotify(!alertsOn)}
              >
                {alertsOn
                  ? t('telegram.disableNotify', { defaultValue: 'Pausar alertas' })
                  : t('telegram.enableNotify', { defaultValue: 'Ativar alertas' })}
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-md pixel-btn-red w-full"
                disabled={busy}
                onClick={() => void unlink()}
              >
                {t('telegram.unlink', { defaultValue: 'Desvincular' })}
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-md w-full sm:col-span-2 lg:col-span-1"
                disabled={busy}
                onClick={() => void refreshUser().then(() => loadStatus())}
              >
                {t('telegram.refresh', { defaultValue: 'Atualizar status' })}
              </button>
            </>
          )}
        </div>

        {msg && <Feedback ok={msgOk}>{msg}</Feedback>}
      </div>
    </Section>
  );
}
