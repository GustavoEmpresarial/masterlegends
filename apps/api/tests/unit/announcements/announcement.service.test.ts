import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnouncementService } from '../../../src/modules/announcements/announcement.service.js';

const now = new Date('2026-06-08T12:00:00Z');

function makeRow(overrides = {}) {
  return {
    id: 'ann-1',
    title: 'Manutenção',
    body: 'Servidor offline às 2h',
    active: true,
    dismissible: true,
    startsAt: null,
    endsAt: null,
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now,
    _count: { dismissals: 0 },
    ...overrides,
  };
}

function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    siteAnnouncement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userAnnouncementDismissal: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    ...overrides,
  } as any;
}

describe('AnnouncementService', () => {
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
  });

  describe('list', () => {
    it('returns all announcements ordered by createdAt desc', async () => {
      const rows = [makeRow({ id: 'ann-2' }), makeRow({ id: 'ann-1' })];
      prisma.siteAnnouncement.findMany.mockResolvedValue(rows);

      const svc = new AnnouncementService(prisma);
      const result = await svc.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ann-2');
    });

    it('maps dates to ISO strings', async () => {
      prisma.siteAnnouncement.findMany.mockResolvedValue([makeRow()]);
      const svc = new AnnouncementService(prisma);
      const [ann] = await svc.list();
      expect(ann.createdAt).toBe(now.toISOString());
      expect(ann.updatedAt).toBe(now.toISOString());
      expect(ann.startsAt).toBeNull();
      expect(ann.endsAt).toBeNull();
    });
  });

  describe('create', () => {
    it('persists and returns mapped announcement', async () => {
      const row = makeRow({ id: 'new-1', createdBy: 'superadmin' });
      prisma.siteAnnouncement.create.mockResolvedValue(row);

      const svc = new AnnouncementService(prisma);
      const result = await svc.create(
        { title: 'Manutenção', body: 'Corpo', active: true, dismissible: true },
        'superadmin',
      );

      expect(prisma.siteAnnouncement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdBy: 'superadmin' }),
        }),
      );
      expect(result.id).toBe('new-1');
    });

    it('converts startsAt and endsAt strings to Date objects', async () => {
      prisma.siteAnnouncement.create.mockResolvedValue(makeRow());
      const svc = new AnnouncementService(prisma);
      await svc.create(
        {
          title: 'T',
          body: 'B',
          active: true,
          dismissible: false,
          startsAt: '2026-06-09T00:00:00Z',
          endsAt: '2026-06-10T00:00:00Z',
        },
        'admin',
      );
      const [call] = prisma.siteAnnouncement.create.mock.calls;
      expect(call[0].data.startsAt).toBeInstanceOf(Date);
      expect(call[0].data.endsAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('throws ANNOUNCEMENT_NOT_FOUND when id missing', async () => {
      prisma.siteAnnouncement.findUnique.mockResolvedValue(null);
      const svc = new AnnouncementService(prisma);
      await expect(svc.update('ghost', { title: 'X' })).rejects.toMatchObject({
        code: 'ANNOUNCEMENT_NOT_FOUND',
      });
      expect(prisma.siteAnnouncement.update).not.toHaveBeenCalled();
    });

    it('applies partial updates', async () => {
      const existing = makeRow();
      const updated = { ...existing, active: false, updatedAt: new Date() };
      prisma.siteAnnouncement.findUnique.mockResolvedValue(existing);
      prisma.siteAnnouncement.update.mockResolvedValue(updated);

      const svc = new AnnouncementService(prisma);
      const result = await svc.update('ann-1', { active: false });

      expect(prisma.siteAnnouncement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
      );
      expect(result.active).toBe(false);
    });
  });

  describe('remove', () => {
    it('deletes announcement and returns ok', async () => {
      prisma.siteAnnouncement.delete.mockResolvedValue({});
      const svc = new AnnouncementService(prisma);
      const result = await svc.remove('ann-1');
      expect(result).toEqual({ ok: true });
      expect(prisma.siteAnnouncement.delete).toHaveBeenCalledWith({ where: { id: 'ann-1' } });
    });
  });

  describe('getActiveForUser', () => {
    it('returns null when no active announcements', async () => {
      prisma.siteAnnouncement.findMany.mockResolvedValue([]);
      const svc = new AnnouncementService(prisma);
      expect(await svc.getActiveForUser('user-1')).toBeNull();
    });

    it('returns non-dismissible announcement immediately', async () => {
      prisma.siteAnnouncement.findMany.mockResolvedValue([makeRow({ dismissible: false })]);
      const svc = new AnnouncementService(prisma);
      const result = await svc.getActiveForUser('user-1');
      expect(result?.id).toBe('ann-1');
      expect(prisma.userAnnouncementDismissal.findUnique).not.toHaveBeenCalled();
    });

    it('skips dismissed announcements', async () => {
      prisma.siteAnnouncement.findMany.mockResolvedValue([
        makeRow({ id: 'ann-1', dismissible: true }),
        makeRow({ id: 'ann-2', dismissible: false }),
      ]);
      prisma.userAnnouncementDismissal.findUnique.mockResolvedValue({ userId: 'user-1', announcementId: 'ann-1' });

      const svc = new AnnouncementService(prisma);
      const result = await svc.getActiveForUser('user-1');
      expect(result?.id).toBe('ann-2');
    });

    it('returns undismissed dismissible announcement', async () => {
      prisma.siteAnnouncement.findMany.mockResolvedValue([makeRow({ dismissible: true })]);
      prisma.userAnnouncementDismissal.findUnique.mockResolvedValue(null);

      const svc = new AnnouncementService(prisma);
      const result = await svc.getActiveForUser('user-1');
      expect(result?.id).toBe('ann-1');
    });
  });

  describe('dismiss', () => {
    it('throws ANNOUNCEMENT_NOT_FOUND when announcement missing', async () => {
      prisma.siteAnnouncement.findUnique.mockResolvedValue(null);
      const svc = new AnnouncementService(prisma);
      await expect(svc.dismiss('user-1', 'ghost')).rejects.toMatchObject({
        code: 'ANNOUNCEMENT_NOT_FOUND',
      });
    });

    it('throws VALIDATION_ERROR when announcement is not dismissible', async () => {
      prisma.siteAnnouncement.findUnique.mockResolvedValue(makeRow({ dismissible: false }));
      const svc = new AnnouncementService(prisma);
      await expect(svc.dismiss('user-1', 'ann-1')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('upserts dismissal record and returns ok', async () => {
      prisma.siteAnnouncement.findUnique.mockResolvedValue(makeRow({ dismissible: true }));
      prisma.userAnnouncementDismissal.upsert.mockResolvedValue({});
      const svc = new AnnouncementService(prisma);
      const result = await svc.dismiss('user-1', 'ann-1');
      expect(result).toEqual({ ok: true });
      expect(prisma.userAnnouncementDismissal.upsert).toHaveBeenCalled();
    });
  });
});
