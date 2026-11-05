import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnouncementService } from '../../../src/modules/announcements/announcement.service.js';

function mockPrisma() {
  return {
    siteAnnouncement: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userAnnouncementDismissal: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe('AnnouncementService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: AnnouncementService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new AnnouncementService(prisma as never);
  });

  it('getActiveForUser returns first non-dismissed dismissible announcement', async () => {
    const row = {
      id: 'a1',
      title: 'Hello',
      body: 'World',
      active: true,
      dismissible: true,
      startsAt: null,
      endsAt: null,
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.siteAnnouncement.findMany.mockResolvedValue([row]);
    prisma.userAnnouncementDismissal.findUnique.mockResolvedValue(null);

    const result = await service.getActiveForUser('u1');
    expect(result?.title).toBe('Hello');
  });

  it('getActiveForUser skips dismissed announcements', async () => {
    prisma.siteAnnouncement.findMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'Old',
        body: 'x',
        active: true,
        dismissible: true,
        startsAt: null,
        endsAt: null,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prisma.userAnnouncementDismissal.findUnique.mockResolvedValue({ dismissedAt: new Date() });

    const result = await service.getActiveForUser('u1');
    expect(result).toBeNull();
  });

  it('dismiss upserts dismissal record', async () => {
    prisma.siteAnnouncement.findUnique.mockResolvedValue({
      id: 'a1',
      dismissible: true,
    });
    await service.dismiss('u1', 'a1');
    expect(prisma.userAnnouncementDismissal.upsert).toHaveBeenCalled();
  });
});
