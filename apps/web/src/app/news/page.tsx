import { useEffect, useState } from 'react';
import type { BlogPostListDTO } from '@mll/shared';
import { apiClient } from '../../lib/api/client';
import {
  PageContentShell,
  PageHero,
  PixelBadge,
  PixelContentCard,
  PixelFilterPills,
} from '../../components/content';

function PostCard({ post }: { post: BlogPostListDTO }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(post.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  const badges =
    post.tags.length > 0 ? (
      <>
        {post.tags.slice(0, 3).map((t) => (
          <PixelBadge key={t} variant="green">
            {t}
          </PixelBadge>
        ))}
      </>
    ) : undefined;

  return (
    <PixelContentCard
      href={`/news/${post.slug}`}
      title={post.title}
      body={post.excerpt ?? ''}
      imageUrl={post.coverImageUrl}
      date={date}
      badges={badges}
      borderColor="var(--green)"
      footer={
        <p className="retro-text text-sm mt-3" style={{ color: 'var(--green)' }}>
          Ler mais →
        </p>
      }
    />
  );
}

export function NewsPage() {
  const [posts, setPosts] = useState<BlogPostListDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  async function load(reset = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (tag) params.set('tag', tag);
      if (search) params.set('q', search);
      if (!reset && nextCursor) params.set('cursor', nextCursor);

      const res = await apiClient.get<{ items: BlogPostListDTO[]; nextCursor: string | null }>(
        `/blog/posts?${params.toString()}`,
      );
      setPosts((prev) => (reset ? res.data.items : [...prev, ...res.data.items]));
      setNextCursor(res.data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, [tag]);

  const allTags = [...new Set(posts.flatMap((p) => p.tags))];
  const tagOptions = allTags.map((t) => ({ value: t, label: t, variant: 'green' as const }));

  return (
    <PageContentShell>
      <PageHero
        title={<><i className="bi bi-newspaper" aria-hidden /> Notícias & Avisos</>}
        subtitle="Fique por dentro de atualizações, eventos e manutenções do Master Legends League"
      />

      <div className="flex flex-col sm:flex-row gap-3 w-full min-w-0">
        <div className="flex flex-1 gap-2 min-w-0">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(q);
                void load(true);
              }
            }}
            placeholder="Buscar posts…"
            className="pixel-input flex-1 min-w-0 text-sm"
          />
          <button type="button" onClick={() => { setSearch(q); void load(true); }} className="pixel-btn pixel-btn-green pixel-btn-sm shrink-0">
            Buscar
          </button>
        </div>
      </div>

      {tagOptions.length > 0 && (
        <PixelFilterPills options={tagOptions} value={tag} onChange={setTag} />
      )}

      {loading && posts.length === 0 ? (
        <div className="pixel-card-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pixel-card pixel-card-fluid h-64 animate-pulse" style={{ background: 'var(--bg-light)' }} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="pixel-card pixel-card-fluid text-center py-16">
          <p className="text-4xl mb-3"><i className="bi bi-envelope" aria-hidden /></p>
          <p className="retro-text text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nenhum post encontrado.
          </p>
        </div>
      ) : (
        <>
          <div className="pixel-card-grid">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          {nextCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void load(false)}
                disabled={loading}
                className="pixel-btn pixel-btn-md"
                style={{ background: 'var(--bg-light)', color: 'var(--text-secondary)' }}
              >
                {loading ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </PageContentShell>
  );
}
