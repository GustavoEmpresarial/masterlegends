import { useEffect, useState } from 'react';
import { fetchPublicJson } from '../../lib/api/publicFetch';
import {
  PageContentShell,
  PageHero,
  PixelBadge,
  PixelContentCard,
  PixelFilterPills,
} from '../../components/content';

interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  imageUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'noticia', label: 'Notícias', variant: 'green' as const },
  { value: 'manutencao', label: 'Manutenção', variant: 'orange' as const },
  { value: 'evento', label: 'Eventos', variant: 'purple' as const },
  { value: 'atualizacao', label: 'Atualizações', variant: 'blue' as const },
];

const PRIORITY_VARIANTS: Record<string, 'red' | 'gold' | 'muted'> = {
  urgent: 'red',
  high: 'gold',
  normal: 'muted',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Importante',
  normal: 'Normal',
};

const CATEGORY_BORDER: Record<string, string> = {
  noticia: 'var(--green)',
  manutencao: 'var(--orange)',
  evento: 'var(--purple)',
  atualizacao: 'var(--blue)',
};

function NoticeCard({ notice }: { notice: Notice }) {
  const cat = CATEGORIES.find((c) => c.value === notice.category);
  const date = new Date(notice.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const badges = (
    <>
      {cat && <PixelBadge variant={cat.variant}>{cat.label}</PixelBadge>}
      {notice.priority !== 'normal' && (
        <PixelBadge variant={PRIORITY_VARIANTS[notice.priority] ?? 'muted'}>
          {PRIORITY_LABELS[notice.priority] ?? notice.priority}
        </PixelBadge>
      )}
    </>
  );

  return (
    <PixelContentCard
      title={notice.title}
      body={notice.body}
      imageUrl={notice.imageUrl}
      date={date}
      badges={badges}
      borderColor={CATEGORY_BORDER[notice.category] ?? 'var(--bg-lighter)'}
    />
  );
}

export function AvisosPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = filter ? `?category=${filter}` : '';
    fetchPublicJson<{ notices: Notice[] }>(`/api/notices${params}`)
      .then((data) => {
        if (cancelled) return;
        setNotices(data.notices);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <PageContentShell>
      <PageHero
        title={<><i className="bi bi-megaphone-fill" aria-hidden /> Avisos</>}
        subtitle="Fique por dentro de atualizações, eventos e manutenções do Master Legends League"
      />

      <PixelFilterPills options={CATEGORIES} value={filter} onChange={setFilter} />

      {loading && notices.length === 0 ? (
        <div className="pixel-card-stack">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pixel-card pixel-card-fluid h-40 animate-pulse" style={{ background: 'var(--bg-light)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="pixel-card pixel-card-fluid text-center p-6" style={{ borderColor: 'var(--red)' }}>
          <p className="retro-text text-red">{error}</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="pixel-card pixel-card-fluid text-center py-12 px-6">
          <img src="/ui/pixel/mascot-v3.png" alt="" className="pixel-sprite mx-auto mb-3 h-40 w-28 object-contain" />
          <p className="retro-text text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
            Nenhum aviso no momento.
          </p>
        </div>
      ) : (
        <div className="pixel-card-stack">
          {notices.map((n) => (
            <NoticeCard key={n.id} notice={n} />
          ))}
        </div>
      )}
    </PageContentShell>
  );
}
