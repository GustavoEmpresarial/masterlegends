import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService } from '../../../src/modules/support/support.service.js';
import { ErrorCode } from '@mll/shared';

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
  };
}

describe('SupportService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: SupportService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new SupportService(prisma as never);
  });

  it('createTicket creates ticket with initial message', async () => {
    prisma.supportTicket.create.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      subject: 'Help',
      category: 'general',
      status: 'open',
      priority: 'normal',
      assignedTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { username: 'alice' },
      messages: [{ createdAt: new Date() }],
    });

    const ticket = await service.createTicket('u1', {
      subject: 'Help',
      category: 'general',
      message: 'Need assistance',
    });
    expect(ticket.subject).toBe('Help');
    expect(prisma.supportTicket.create).toHaveBeenCalled();
  });

  it('addAdminMessage updates ticket to in_progress', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1', status: 'open' });
    prisma.supportMessage.create.mockResolvedValue({
      id: 'm1',
      ticketId: 't1',
      authorType: 'admin',
      authorId: 'admin1',
      body: 'Hi',
      createdAt: new Date(),
      attachments: [],
    });

    const msg = await service.addAdminMessage('t1', 'admin1', 'Hi');
    expect(msg.message.body).toBe('Hi');
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
  });

  it('getTicketForUser throws when not found', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);
    await expect(service.getTicketForUser('u1', 'missing')).rejects.toMatchObject({
      code: ErrorCode.SUPPORT_TICKET_NOT_FOUND,
    });
  });

  it('getTicketForUser returns ticket with messages', async () => {
    const now = new Date();
    prisma.supportTicket.findFirst.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      subject: 'Bug report',
      category: 'bug',
      status: 'open',
      priority: 'normal',
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
      user: { username: 'alice' },
      messages: [
        {
          id: 'm1',
          ticketId: 't1',
          authorType: 'user',
          authorId: 'u1',
          body: 'Hello',
          createdAt: now,
          attachments: [],
        },
      ],
    });
    const detail = await service.getTicketForUser('u1', 't1');
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0].body).toBe('Hello');
  });

  it('addUserMessage throws when ticket not found', async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);
    await expect(service.addUserMessage('u1', 'missing', 'text')).rejects.toMatchObject({
      code: ErrorCode.SUPPORT_TICKET_NOT_FOUND,
    });
  });

  it('addUserMessage creates message and updates ticket', async () => {
    const now = new Date();
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', status: 'open' });
    prisma.supportMessage.create.mockResolvedValue({
      id: 'm2',
      ticketId: 't1',
      authorType: 'user',
      authorId: 'u1',
      body: 'Follow up',
      createdAt: now,
      attachments: [],
    });
    prisma.supportTicket.update.mockResolvedValue({});

    const msg = await service.addUserMessage('u1', 't1', 'Follow up');
    expect(msg.body).toBe('Follow up');
    expect(prisma.supportTicket.update).toHaveBeenCalled();
  });

  it('addUserMessage reopens closed ticket', async () => {
    const now = new Date();
    prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', status: 'closed' });
    prisma.supportMessage.create.mockResolvedValue({
      id: 'm3', ticketId: 't1', authorType: 'user', authorId: 'u1', body: 'Reopening', createdAt: now,
      attachments: [],
    });
    prisma.supportTicket.update.mockResolvedValue({});

    await service.addUserMessage('u1', 't1', 'Reopening');
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'open' }) }),
    );
  });

  it('patchTicket throws when not found', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(null);
    await expect(service.patchTicket('ghost', { status: 'closed' })).rejects.toMatchObject({
      code: ErrorCode.SUPPORT_TICKET_NOT_FOUND,
    });
  });

  it('patchTicket updates partial fields', async () => {
    const now = new Date();
    prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1' });
    prisma.supportTicket.update.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      subject: 'X',
      category: 'general',
      status: 'closed',
      priority: 'normal',
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
      user: { username: 'alice' },
      messages: [],
    });

    const result = await service.patchTicket('t1', { status: 'closed' });
    expect(result.status).toBe('closed');
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'closed' }) }),
    );
  });

  it('listForUser returns mapped tickets', async () => {
    const now = new Date();
    prisma.supportTicket.findMany.mockResolvedValue([
      {
        id: 't1',
        userId: 'u1',
        subject: 'Q',
        category: 'general',
        status: 'open',
        priority: 'normal',
        assignedTo: null,
        createdAt: now,
        updatedAt: now,
        user: { username: 'alice' },
        messages: [],
      },
    ]);
    const tickets = await service.listForUser('u1');
    expect(tickets).toHaveLength(1);
    expect(tickets[0].subject).toBe('Q');
  });
});
