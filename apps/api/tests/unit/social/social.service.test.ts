import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialService } from '../../../src/modules/social/social.service.js';
import { YoutubeCreatorStatus, YoutubeVideoStatus } from '@mll/shared';

function makeCreator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'creator-1',
    userId: 'user-1',
    channelName: 'Canal Teste',
    channelUrl: 'https://www.youtube.com/@teste',
    description: 'Descrição do canal de teste aqui',
    photoUrl: '/uploads/youtube-creators/x.jpg',
    status: YoutubeCreatorStatus.APPROVED,
    rejectionReason: null,
    reviewedBy: 'admin',
    reviewedAt: new Date('2026-06-01'),
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    creatorId: 'creator-1',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoId: 'dQw4w9WgXcQ',
    status: YoutubeVideoStatus.APPROVED,
    weekStart: new Date('2026-06-02'),
    rejectionReason: null,
    reviewedBy: 'admin',
    reviewedAt: new Date('2026-06-03'),
    nftGrantedAt: new Date('2026-06-03'),
    createdAt: new Date('2026-06-02'),
    ...overrides,
  };
}

function makePrisma() {
  return {
    youtubeCreator: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    youtubeVideo: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    basePlayer: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    club: { update: vi.fn() },
    platformConfig: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('SocialService — approved listings', () => {
  it('listApprovedCreators returns only approved creators with video count', async () => {
    const prisma = makePrisma();
    prisma.youtubeCreator.findMany.mockResolvedValue([
      {
        ...makeCreator(),
        user: { username: 'tester', email: 'test@example.com' },
        _count: { videos: 2 },
      },
    ]);
    const svc = new SocialService(prisma as never);
    const result = await svc.listApprovedCreators();

    expect(prisma.youtubeCreator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: YoutubeCreatorStatus.APPROVED } }),
    );
    expect(result.creators).toHaveLength(1);
    expect(result.creators[0].videoCount).toBe(2);
    expect(result.creators[0].username).toBe('tester');
  });

  it('listApprovedVideos returns approved videos with creator info', async () => {
    const prisma = makePrisma();
    const creator = makeCreator();
    prisma.youtubeVideo.findMany.mockResolvedValue([
      {
        ...makeVideo(),
        creator: { ...creator, user: { username: 'tester' } },
      },
    ]);
    const svc = new SocialService(prisma as never);
    const result = await svc.listApprovedVideos();

    expect(prisma.youtubeVideo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: YoutubeVideoStatus.APPROVED } }),
    );
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].creator?.channelName).toBe('Canal Teste');
  });
});

describe('SocialService — revokeCreator', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: SocialService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new SocialService(prisma as never);
  });

  it('revokes approved creator and cascades to pending/approved videos', async () => {
    const creator = makeCreator();
    prisma.youtubeCreator.findUnique.mockResolvedValue(creator);
    prisma.$transaction.mockResolvedValue([]);
    prisma.youtubeCreator.findUniqueOrThrow.mockResolvedValue({
      ...creator,
      status: YoutubeCreatorStatus.REVOKED,
      rejectionReason: 'Violação de regras',
    });

    const result = await svc.revokeCreator('creator-1', 'admin', 'Violação de regras');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect(result.creator.status).toBe(YoutubeCreatorStatus.REVOKED);
  });

  it('does not touch BasePlayer when revoking creator', async () => {
    prisma.youtubeCreator.findUnique.mockResolvedValue(makeCreator());
    prisma.$transaction.mockResolvedValue([]);
    prisma.youtubeCreator.findUniqueOrThrow.mockResolvedValue(
      makeCreator({ status: YoutubeCreatorStatus.REVOKED }),
    );

    await svc.revokeCreator('creator-1', 'admin', 'motivo');

    expect(prisma.basePlayer.create).not.toHaveBeenCalled();
    expect(prisma.basePlayer.aggregate).not.toHaveBeenCalled();
  });

  it('throws when creator is not approved', async () => {
    prisma.youtubeCreator.findUnique.mockResolvedValue(
      makeCreator({ status: YoutubeCreatorStatus.PENDING }),
    );
    await expect(svc.revokeCreator('creator-1', 'admin', 'motivo')).rejects.toMatchObject({
      code: 'SOCIAL_CREATOR_NOT_FOUND',
    });
  });
});

describe('SocialService — getPublicFeed', () => {
  it('excludes videos from revoked creators', async () => {
    const prisma = makePrisma();
    prisma.youtubeVideo.findMany.mockResolvedValue([
      {
        ...makeVideo(),
        creator: {
          id: 'creator-1',
          channelName: 'Ativo',
          channelUrl: 'https://www.youtube.com/@ativo',
          photoUrl: '/x.jpg',
          status: YoutubeCreatorStatus.APPROVED,
        },
      },
      {
        ...makeVideo({ id: 'video-2', videoId: 'abc12345678' }),
        creator: {
          id: 'creator-2',
          channelName: 'Revogado',
          channelUrl: 'https://www.youtube.com/@revogado',
          photoUrl: '/y.jpg',
          status: YoutubeCreatorStatus.REVOKED,
        },
      },
    ]);
    const svc = new SocialService(prisma as never);
    const result = await svc.getPublicFeed();

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].creator?.channelName).toBe('Ativo');
  });
});

describe('SocialService — revokeVideo', () => {
  it('revokes an approved video without touching BasePlayer', async () => {
    const prisma = makePrisma();
    prisma.youtubeVideo.findUnique.mockResolvedValue(makeVideo());
    prisma.youtubeVideo.update.mockResolvedValue(
      makeVideo({ status: YoutubeVideoStatus.REVOKED, rejectionReason: 'motivo' }),
    );
    const svc = new SocialService(prisma as never);

    const result = await svc.revokeVideo('video-1', 'admin', 'motivo');

    expect(result.video.status).toBe(YoutubeVideoStatus.REVOKED);
    expect(prisma.basePlayer.create).not.toHaveBeenCalled();
  });
});
