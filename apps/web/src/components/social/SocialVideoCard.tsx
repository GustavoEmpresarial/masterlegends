import type { YoutubeVideoDTO } from '@mll/shared';

interface SocialVideoCardProps {
  video: YoutubeVideoDTO;
}

export function SocialVideoCard({ video }: SocialVideoCardProps) {
  const creator = video.creator;
  if (!creator) return null;

  return (
    <article className="pixel-box-light overflow-hidden" style={{ borderColor: 'var(--bg-lighter)' }}>
      <div className="aspect-video w-full bg-black">
        <iframe
          title={creator.channelName}
          src={`https://www.youtube.com/embed/${video.videoId}`}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={creator.photoUrl}
            alt={creator.channelName}
            className="h-14 w-14 shrink-0 border-2 object-cover"
            style={{ borderColor: 'var(--red)' }}
          />
          <div className="min-w-0">
            <p className="pixel-text text-lg truncate" style={{ color: 'var(--text-primary)' }}>
              {creator.channelName}
            </p>
            <p className="retro-text text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {creator.channelUrl.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>
        <a
          href={creator.channelUrl}
          target="_blank"
          rel="noreferrer"
          className="pixel-btn pixel-btn-red pixel-btn-md shrink-0 text-center"
        >
          ▶ Visitar canal
        </a>
      </div>
    </article>
  );
}
