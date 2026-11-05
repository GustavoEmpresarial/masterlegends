import { useCallback, useEffect, useState } from 'react';
import type { ScoutPlayerDTO } from '@mll/shared';
import { ScoutRevealCard, type ScoutRevealCardConfig } from './ScoutRevealCard';

interface ScoutRevealCarouselProps {
  players: Array<ScoutPlayerDTO & { sprite?: string }>;
  rarityConfig: Record<string, ScoutRevealCardConfig>;
  animate?: boolean;
}

function pageSizeForWidth(count: number, width: number): number {
  if (count <= 1) return 1;
  if (width < 560) return Math.min(2, count);
  if (width < 840) return Math.min(3, count);
  if (width < 1100) return Math.min(4, count);
  return Math.min(5, count);
}

export function ScoutRevealCarousel({ players, rarityConfig, animate = true }: ScoutRevealCarouselProps) {
  const count = players.length;
  const isSolo = count === 1;
  const [viewportW, setViewportW] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const perPage = pageSizeForWidth(count, viewportW);

  const pageCount = Math.max(1, Math.ceil(count / perPage));
  const [page, setPage] = useState(0);

  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.max(0, Math.min(pageCount - 1, p + delta)));
    },
    [pageCount],
  );

  useEffect(() => {
    setPage(0);
  }, [players]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  useEffect(() => {
    if (isSolo) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, isSolo]);

  if (isSolo) {
    const player = players[0]!;
    return (
      <div className="scout-reveal-carousel scout-reveal-carousel--solo">
        <ScoutRevealCard
          player={player}
          config={rarityConfig[player.rarity] ?? rarityConfig.common}
          size="hero"
          index={0}
          animate={animate}
        />
      </div>
    );
  }

  const slideBasis = `${100 / perPage}%`;
  const trackTranslate = page * 100;
  const activeRange = { start: page * perPage, end: page * perPage + perPage };

  return (
    <div
      className={`scout-reveal-carousel scout-reveal-carousel--per-${perPage}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Recruited players"
    >
      <div className="scout-reveal-carousel__frame">
        <button
          type="button"
          className="scout-reveal-carousel__nav scout-reveal-carousel__nav--prev"
          onClick={() => go(-1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          ‹
        </button>

        <div className="scout-reveal-carousel__viewport">
          <div
            className="scout-reveal-carousel__track"
            style={{ transform: `translateX(-${trackTranslate}%)` }}
          >
            {players.map((player, index) => {
              const isVisible = index >= activeRange.start && index < activeRange.end;
              return (
                <div
                  key={player.id}
                  className="scout-reveal-carousel__slide"
                  style={{ flex: `0 0 ${slideBasis}`, maxWidth: slideBasis, minWidth: 0 }}
                >
                  <ScoutRevealCard
                    player={player}
                    config={rarityConfig[player.rarity] ?? rarityConfig.common}
                    size="compact"
                    index={index}
                    animate={animate && isVisible}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="scout-reveal-carousel__nav scout-reveal-carousel__nav--next"
          onClick={() => go(1)}
          disabled={page === pageCount - 1}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <div className="scout-reveal-carousel__footer">
        <span className="scout-reveal-carousel__counter">
          {Math.min(count, (page + 1) * perPage)} / {count}
        </span>
        <div className="scout-reveal-carousel__dots" role="tablist">
          {Array.from({ length: pageCount }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === page}
              aria-label={`Page ${idx + 1}`}
              className={`scout-reveal-carousel__dot${idx === page ? ' scout-reveal-carousel__dot--active' : ''}`}
              onClick={() => setPage(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
