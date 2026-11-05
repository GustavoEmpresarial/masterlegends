import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import { adminClient } from '../../lib/api/adminClient';

interface SupportAttachmentImageProps {
  attachmentId: string;
  variant: 'user' | 'admin';
  alt?: string;
  className?: string;
}

export function SupportAttachmentImage({
  attachmentId,
  variant,
  alt = 'Attachment',
  className = 'max-h-40 rounded border border-[var(--bg-lighter)] object-contain',
}: SupportAttachmentImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const client = variant === 'admin' ? adminClient : apiClient;
        const path =
          variant === 'admin'
            ? `/support/attachments/${attachmentId}`
            : `/api/support/attachments/${attachmentId}`;
        const { data } = await client.get<Blob>(path, { responseType: 'blob' });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, variant]);

  if (failed) {
    return (
      <span className="retro-text text-xs" style={{ color: 'var(--text-muted)' }}>
        [image unavailable]
      </span>
    );
  }

  if (!src) {
    return (
      <span className="retro-text text-xs animate-blink" style={{ color: 'var(--text-muted)' }}>
        …
      </span>
    );
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block">
      <img src={src} alt={alt} className={className} draggable={false} />
    </a>
  );
}
