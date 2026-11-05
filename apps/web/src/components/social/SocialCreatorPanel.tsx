import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { SocialMeDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import { translateError } from '../../lib/apiError';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

function validatePhoto(file: File | null, t: (key: string) => string): string | null {
  if (!file) return null;
  if (!ACCEPT.split(',').includes(file.type)) {
    return t('social.invalidImage');
  }
  if (file.size > MAX_BYTES) {
    return t('social.imageTooLarge');
  }
  return null;
}

interface SocialCreatorPanelProps {
  me: SocialMeDTO;
}

export function SocialCreatorPanel({ me }: SocialCreatorPanelProps) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [channelName, setChannelName] = useState(me.creator?.channelName ?? '');
  const [channelUrl, setChannelUrl] = useState(me.creator?.channelUrl ?? '');
  const [description, setDescription] = useState(me.creator?.description ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const creator = me.creator;
  const isApproved = creator?.status === 'approved';
  const isPending = creator?.status === 'pending';
  const isRejected = creator?.status === 'rejected';
  const isRevoked = creator?.status === 'revoked';

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['social'] });
  }

  async function submitApply() {
    setError('');
    const photoErr = validatePhoto(photo, t);
    if (photoErr) {
      setError(photoErr);
      return;
    }
    if (!photo) {
      setError(t('social.photoRequired'));
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('channelName', channelName.trim());
      form.append('channelUrl', channelUrl.trim());
      form.append('description', description.trim());
      form.append('photo', photo);
      await apiClient.post('/api/social/apply', form);
      setPhoto(null);
      await refresh();
    } catch (err) {
      setError(translateError(err, 'UNKNOWN'));
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile() {
    setError('');
    const photoErr = validatePhoto(photo, t);
    if (photoErr) {
      setError(photoErr);
      return;
    }
    setBusy(true);
    try {
      if (photo) {
        const form = new FormData();
        form.append('channelName', channelName.trim());
        form.append('description', description.trim());
        form.append('photo', photo);
        await apiClient.patch('/api/social/profile', form);
      } else {
        await apiClient.patch('/api/social/profile', {
          channelName: channelName.trim(),
          description: description.trim(),
        });
      }
      setPhoto(null);
      await refresh();
    } catch (err) {
      setError(translateError(err, 'UNKNOWN'));
    } finally {
      setBusy(false);
    }
  }

  async function submitVideo() {
    setError('');
    setBusy(true);
    try {
      await apiClient.post('/api/social/videos', { videoUrl: videoUrl.trim() });
      setVideoUrl('');
      await refresh();
    } catch (err) {
      setError(translateError(err, 'UNKNOWN'));
    } finally {
      setBusy(false);
    }
  }

  if (isRevoked) {
    return (
      <div className="pixel-card p-4 sm:p-6 text-center space-y-3" style={{ borderColor: 'var(--red)', background: 'var(--bg-medium)' }}>
        <p className="pixel-text text-lg mb-2" style={{ color: 'var(--red)' }}>
          {t('social.revokedTitle', { defaultValue: 'Canal revogado' })}
        </p>
        <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('social.revokedHint', { defaultValue: 'Seu credenciamento foi revogado. Você não pode enviar novos vídeos. Recompensas já recebidas permanecem no seu inventário.' })}
        </p>
        {creator?.rejectionReason && (
          <p className="retro-text text-sm text-red">{creator.rejectionReason}</p>
        )}
      </div>
    );
  }

  if (!creator || isRejected) {
    return (
      <div className="pixel-card p-4 sm:p-6 space-y-4" style={{ borderColor: 'var(--red)', background: 'var(--bg-medium)' }}>
        <h3 className="pixel-text text-lg" style={{ color: 'var(--red)' }}>
          ▶ {t('social.applyTitle')}
        </h3>
        <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('social.applyHint')}
        </p>
        {isRejected && creator?.rejectionReason && (
          <p className="retro-text text-sm text-red">{creator.rejectionReason}</p>
        )}
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.channelName')}</span>
          <input className="pixel-input w-full" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.channelUrl')}</span>
          <input className="pixel-input w-full" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://www.youtube.com/@canal" />
        </label>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.description')}</span>
          <textarea className="pixel-input w-full min-h-[96px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.channelPhoto')}</span>
          <input
            type="file"
            accept={ACCEPT}
            className="retro-text text-sm w-full"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && <p className="retro-text text-sm text-red">{error}</p>}
        <button type="button" className="pixel-btn pixel-btn-red pixel-btn-md w-full" disabled={busy} onClick={() => void submitApply()}>
          {busy ? t('actions.loading') : t('social.submitApplication')}
        </button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="pixel-card p-4 sm:p-6 text-center" style={{ borderColor: 'var(--gold)', background: 'var(--bg-medium)' }}>
        <p className="pixel-text text-lg mb-2" style={{ color: 'var(--gold)' }}>
          {t('social.pendingTitle')}
        </p>
        <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('social.pendingHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="pixel-card p-4 sm:p-6 space-y-4" style={{ borderColor: 'var(--red)', background: 'var(--bg-medium)' }}>
        <h3 className="pixel-text text-lg" style={{ color: 'var(--red)' }}>
          ▶ {t('social.profileTitle')}
        </h3>
        <div className="flex items-center gap-3">
          <img src={creator.photoUrl} alt={creator.channelName} className="h-16 w-16 border-2 object-cover" style={{ borderColor: 'var(--red)' }} />
          <div>
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('social.channelUrl')}
            </p>
            <p className="retro-text text-sm break-all">{creator.channelUrl}</p>
          </div>
        </div>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.channelName')}</span>
          <input className="pixel-input w-full" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.description')}</span>
          <textarea className="pixel-input w-full min-h-[96px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="ui-label-sm">{t('social.changePhoto')}</span>
          <input type="file" accept={ACCEPT} className="retro-text text-sm w-full" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" className="pixel-btn pixel-btn-md w-full" disabled={busy} onClick={() => void submitProfile()}>
          {busy ? t('actions.loading') : t('social.saveProfile')}
        </button>
      </div>

      {isApproved && (
        <div className="pixel-card p-4 sm:p-6 space-y-3" style={{ borderColor: 'var(--gold)', background: 'var(--bg-medium)' }}>
          <h3 className="pixel-text text-lg" style={{ color: 'var(--gold)' }}>
            {t('social.submitVideoTitle')}
          </h3>

          {/* Reward info */}
          <div className="pixel-box p-3 space-y-1" style={{ borderColor: 'var(--purple)' }}>
            <p className="retro-text text-sm font-bold" style={{ color: 'var(--purple)' }}>
              <i className="bi bi-trophy-fill" aria-hidden /> Recompensa por vídeo aprovado
            </p>
            <p className="retro-text text-sm" style={{ color: 'var(--text-primary)' }}>
              <i className="bi bi-shield-fill" aria-hidden /> <strong>1 jogador temporário</strong> por vídeo aprovado — válido por <strong>30 dias</strong>.
            </p>
            <p className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
              Máximo de {me.weeklyVideosLimit} vídeos por semana = até {me.weeklyVideosLimit} jogadores/semana.
            </p>
          </div>

          <p className="retro-text text-sm" style={{ color: me.weeklyVideosUsed >= me.weeklyVideosLimit ? 'var(--orange)' : 'var(--text-secondary)' }}>
            <i className="bi bi-calendar-event-fill" aria-hidden /> Esta semana: {me.weeklyVideosUsed}/{me.weeklyVideosLimit} vídeos enviados
          </p>
          <input
            className="pixel-input w-full"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={!me.canSubmitVideo}
          />
          <button
            type="button"
            className="pixel-btn pixel-btn-red pixel-btn-md w-full"
            disabled={busy || !me.canSubmitVideo || !videoUrl.trim()}
            onClick={() => void submitVideo()}
          >
            {busy ? t('actions.loading') : t('social.submitVideo')}
          </button>
        </div>
      )}

      {error && <p className="retro-text text-sm text-red">{error}</p>}
    </div>
  );
}
