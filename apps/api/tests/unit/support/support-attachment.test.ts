import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService } from '../../../src/modules/support/support.service.js';
import { ErrorCode } from '@mll/shared';
import sharp from 'sharp';

vi.mock('../../../src/common/lib/secure-image.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/common/lib/secure-image.js')>();
  return {
    ...actual,
    saveSupportImage: vi.fn(async () => ({
      storageKey: 'test-file.webp',
      mimeType: 'image/webp',
      sizeBytes: 100,
      width: 10,
      height: 10,
    })),
    deleteSupportImage: vi.fn(),
    readSupportImage: vi.fn(async () => ({
      buffer: Buffer.from('x'),
      mimeType: 'image/webp',
    })),
  };
});

function mockPrisma() {
  return {
    supportTicket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    supportMessage: {
      create: vi.fn(),
    },
    supportAttachment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe('SupportService attachments', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: SupportService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new SupportService(prisma as never);
    vi.clearAllMocks();
  });

  it('createTicket requires message or images', async () => {
    await expect(
      service.createTicket('u1', { subject: 'Help', category: 'general', message: '   ' }, []),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('createTicket with image only succeeds', async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    prisma.supportTicket.create.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      subject: 'Screenshot',
      category: 'general',
      status: 'open',
      priority: 'normal',
      assignedTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { username: 'alice' },
      messages: [{ createdAt: new Date() }],
    });

    const ticket = await service.createTicket(
      'u1',
      { subject: 'Screenshot', category: 'general', message: '' },
      [png],
    );
    expect(ticket.subject).toBe('Screenshot');
    expect(prisma.supportTicket.create).toHaveBeenCalled();
  });

  it('getAttachmentForUser denies other users', async () => {
    prisma.supportAttachment.findUnique.mockResolvedValue({
      id: 'a1',
      storageKey: 'test-file.webp',
      mimeType: 'image/webp',
      sizeBytes: 100,
      width: 10,
      height: 10,
      message: { ticket: { userId: 'other-user' } },
    });

    await expect(service.getAttachmentForUser('u1', 'a1')).rejects.toMatchObject({
      code: ErrorCode.SUPPORT_ATTACHMENT_NOT_FOUND,
    });
  });

  it('getAttachmentForUser allows ticket owner', async () => {
    prisma.supportAttachment.findUnique.mockResolvedValue({
      id: 'a1',
      storageKey: 'test-file.webp',
      mimeType: 'image/webp',
      sizeBytes: 100,
      width: 10,
      height: 10,
      message: { ticket: { userId: 'u1' } },
    });

    const result = await service.getAttachmentForUser('u1', 'a1');
    expect(result.attachment.id).toBe('a1');
    expect(result.file.mimeType).toBe('image/webp');
  });

  it('addUserMessage maps attachments in response', async () => {
    const now = new Date();
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', status: 'open' });
    prisma.supportMessage.create.mockResolvedValue({
      id: 'm1',
      ticketId: 't1',
      authorType: 'user',
      authorId: 'u1',
      body: 'see photo',
      createdAt: now,
      attachments: [
        { id: 'a1', mimeType: 'image/webp', sizeBytes: 100, width: 10, height: 10 },
      ],
    });
    prisma.supportTicket.update.mockResolvedValue({});

    const msg = await service.addUserMessage('u1', 't1', 'see photo', []);
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].id).toBe('a1');
  });
});
