import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useWalletLink, type WalletConnectStep } from '../../hooks/useWallet';
import { useWalletHistory } from '../../hooks/useApi';
import { formatWalletAddress } from '../../lib/wallet/connect';
import { translateError } from '../../lib/apiError';

interface WalletPanelProps {
  compact?: boolean;
}

export function WalletPanel({ compact = false }: WalletPanelProps) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { connect, disconnect, isWalletInstalled: walletInstalledFn } = useWalletLink();
  const { data: walletHistory } = useWalletHistory();
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [connectStep, setConnectStep] = useState<WalletConnectStep>('idle');
  // Only probe window.ethereum after explicit user intent (or when already linked).
  const [probedInstall, setProbedInstall] = useState<boolean | null>(null);

  const linked = !!user?.wallet;
  const showInstallPrompt = probedInstall === false && !linked;

  const stepHint: Record<WalletConnectStep, string> = {
    idle: '',
    challenge: t('wallet.steps.connecting', { defaultValue: 'Preparando conexão…' }),
    connect: t('wallet.steps.unlock', { defaultValue: 'Desbloqueie o MetaMask e aprove a conexão.' }),
    sign: t('wallet.steps.sign', { defaultValue: 'Assine a mensagem no MetaMask para vincular.' }),
    linking: t('wallet.steps.linking', { defaultValue: 'Vinculando wallet à sua conta…' }),
  };

  const handleConnect = async () => {
    setError('');
    setErrorCode('');
    const installed = walletInstalledFn();
    setProbedInstall(installed);
    if (!installed) return;
    setConnectStep('challenge');
    try {
      await connect.mutateAsync(setConnectStep);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setErrorCode(code);
      setError(translateError(err, 'WALLET_CONNECT_FAILED'));
    } finally {
      setConnectStep('idle');
    }
  };

  const handleDisconnect = async () => {
    setError('');
    try {
      await disconnect.mutateAsync();
    } catch (err: unknown) {
      setError(translateError(err, 'WALLET_DISCONNECT_FAILED'));
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-6'}>
      <div
        className={compact ? 'pixel-box-light p-4' : 'pixel-card p-6'}
        style={{ borderColor: 'var(--purple)' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <i className="bi bi-wallet2 text-3xl" aria-hidden />
          <div>
            <h2 className="pixel-text text-lg" style={{ color: 'var(--purple)' }}>
              {t('wallet.title')}
            </h2>
            {!compact && (
              <p className="retro-text mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('wallet.pageSubtitle')}
              </p>
            )}
          </div>
        </div>

        <div
          className="pixel-box mb-4 px-4 py-3"
          style={{
            borderColor: linked ? 'var(--green)' : 'var(--bg-lighter)',
            background: linked ? 'var(--bg-light)' : 'var(--bg-dark)',
          }}
        >
          <p className="ui-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('wallet.statusLabel')}
          </p>
          <p className="retro-text text-sm" style={{ color: linked ? 'var(--green)' : 'var(--text-secondary)' }}>
            {linked ? t('wallet.statusLinked') : t('wallet.statusUnlinked')}
          </p>
        </div>

        {showInstallPrompt ? (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            className="pixel-btn pixel-btn-blue pixel-btn-md w-full"
            title={t('wallet.installHint')}
          >
            {t('wallet.install')}
          </a>
        ) : linked && user.wallet ? (
          <div className="space-y-3">
            <div
              className="pixel-box-light flex items-center gap-3 px-4 py-3"
              style={{ borderColor: 'var(--purple)' }}
              title={user.wallet}
            >
              <i className="bi bi-wallet2 text-2xl" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="ui-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('wallet.addressLabel')}
                </p>
                <p className="retro-text truncate text-sm font-bold" style={{ color: 'var(--purple)' }}>
                  {user.wallet}
                </p>
                <p className="retro-text mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatWalletAddress(user.wallet)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              className="pixel-btn pixel-btn-red pixel-btn-md w-full"
            >
              {disconnect.isPending ? t('actions.loading') : t('wallet.disconnect')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connect.isPending}
            className="pixel-btn pixel-btn-blue pixel-btn-md w-full"
            title={t('wallet.connectHint')}
          >
            {connect.isPending ? t('wallet.connecting') : t('wallet.connect')}
          </button>
        )}

        {connect.isPending && connectStep !== 'idle' && (
          <p className="retro-text mt-3 text-xs" style={{ color: 'var(--blue)' }}>
            {stepHint[connectStep]}
          </p>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-1">
            <p className="retro-text text-sm text-red">{error}</p>
            {(errorCode === 'WALLET_USER_REJECTED' || errorCode === 'WALLET_CHAIN_REJECTED') && (
              <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('wallet.connectRetryHint')}
              </p>
            )}
          </motion.div>
        )}
      </div>

      {!compact && walletHistory?.history && walletHistory.history.length > 0 && (
        <div className="pixel-card p-5" style={{ borderColor: 'var(--purple)' }}>
          <h3 className="pixel-text mb-3 text-sm" style={{ color: 'var(--purple)' }}>
            <i className="bi bi-clock-history" aria-hidden /> HISTÓRICO DE CARTEIRAS
          </h3>
          <p className="retro-text text-xs mb-3" style={{ color: '#ffffff' }}>
            Toda conexão e desconexão de carteira fica registrada aqui.
          </p>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {walletHistory.history.map((entry) => {
              const isLink = entry.action === 'linked';
              const color = isLink ? 'var(--green)' : 'var(--red)';
              return (
                <li
                  key={entry.id}
                  className="pixel-box-light px-3 py-2 flex items-start gap-3"
                  style={{ borderColor: color }}
                >
                  <i
                    className={`bi ${isLink ? 'bi-plug-fill' : 'bi-x-lg'}`}
                    style={{ fontSize: 18, lineHeight: 1, color }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="ui-label-sm"
                        style={{ color, letterSpacing: '0.05em' }}
                      >
                        {isLink ? 'CONECTADA' : 'DESCONECTADA'}
                      </span>
                      <span
                        className="retro-text text-[10px]"
                        style={{ color: '#ffffff', opacity: 0.6 }}
                      >
                        {new Date(entry.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {entry.wallet && (
                      <p
                        className="retro-text text-xs font-mono break-all mt-1"
                        style={{ color: '#ffffff' }}
                        title={entry.wallet}
                      >
                        {formatWalletAddress(entry.wallet)}
                      </p>
                    )}
                    {entry.ip && (
                      <p
                        className="retro-text text-[10px] mt-0.5"
                        style={{ color: '#ffffff', opacity: 0.6 }}
                      >
                        IP {entry.ip}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!compact && (
        <div className="pixel-card p-6" style={{ borderColor: 'var(--blue)' }}>
          <h3 className="pixel-text mb-4 text-sm" style={{ color: 'var(--blue)' }}>
            {t('wallet.howItWorksTitle')}
          </h3>
          <ol className="space-y-3">
            {[1, 2, 3].map((step) => (
              <li key={step} className="flex gap-3">
                <span
                  className="pixel-box flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold"
                  style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                >
                  {step}
                </span>
                <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t(`wallet.steps.${step}`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
