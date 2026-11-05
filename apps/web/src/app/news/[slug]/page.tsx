import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { BlogPostDTO } from '@mll/shared';
import { apiClient } from '../../../lib/api/client';
import { PageContentShell, PixelBadge, PixelContentCard } from '../../../components/content';

export function NewsPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    apiClient
      .get<BlogPostDTO>(`/blog/posts/${slug}`)
      .then((r) => setPost(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <PageContentShell className="py-16">
        <div className="pixel-card pixel-card-fluid animate-pulse space-y-4 p-8">
          <div className="h-8 bg-[var(--bg-light)] w-3/4" />
          <div className="h-64 bg-[var(--bg-light)]" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-3 bg-[var(--bg-light)]" />
            ))}
          </div>
        </div>
      </PageContentShell>
    );
  }

  if (notFound || !post) {
    return (
      <PageContentShell className="py-20 text-center space-y-4">
        <p className="text-5xl"><i className="bi bi-search" aria-hidden /></p>
        <p className="retro-text text-lg" style={{ color: 'var(--text-secondary)' }}>
          Post não encontrado.
        </p>
        <Link to="/news" className="retro-text text-sm underline" style={{ color: 'var(--green)' }}>
          ← Voltar para notícias
        </Link>
      </PageContentShell>
    );
  }

  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const dateLabel = [date, post.createdBy].filter(Boolean).join(' · ');

  return (
    <PageContentShell className="py-4 sm:py-8">
      <Link
        to="/news"
        className="retro-text text-xs inline-flex items-center gap-1 mb-6 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← Notícias &amp; Avisos
      </Link>

      {post.excerpt && (
        <p
          className="retro-text text-sm sm:text-base italic leading-relaxed mb-4 px-1 border-l-4 pl-4"
          style={{ borderColor: 'var(--green)', color: 'var(--text-secondary)' }}
        >
          {post.excerpt}
        </p>
      )}

      <PixelContentCard
        borderColor="var(--green)"
        imageUrl={post.coverImageUrl ?? undefined}
        title={post.title}
        body={post.content}
        date={dateLabel}
        badges={
          post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link key={tag} to={`/news?tag=${encodeURIComponent(tag)}`}>
                  <PixelBadge variant="green">{tag}</PixelBadge>
                </Link>
              ))}
            </div>
          ) : undefined
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-[var(--bg-lighter)]">
            <Link
              to="/news"
              className="retro-text text-sm inline-flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              ← Mais notícias
            </Link>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})}
              className="retro-text text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              <i className="bi bi-link-45deg" aria-hidden /> Copiar link
            </button>
          </div>
        }
      />
    </PageContentShell>
  );
}
