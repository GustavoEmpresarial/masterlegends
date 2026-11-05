import type { PrismaClient } from '@prisma/client';
import type {
  SupportAttachmentDTO,
  SupportMessageDTO,
  SupportTicketDetailDTO,
  SupportTicketDTO,
} from '@mll/shared';
import { config } from '../../config/env.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  buildAdminUserWhere,
  type AdminUserListFilters,
} from '../admin/admin-user-filters.util.js';
import {
  deleteSupportImage,
  readSupportImage,
  saveSupportImage,
  type SanitizedImageResult,
} from '../../common/lib/secure-image.js';

function mapAttachment(row: {
  id: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}): SupportAttachmentDTO {
  return {
    id: row.id,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
  };
}

function mapTicket(
  row: {
    id: string;
    userId: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    assignedTo: string | null;
    hasUnreadAdminReply?: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      username: string | null;
      email?: string | null;
      wallet?: string | null;
      club?: { name: string | null } | null;
      _count?: {
        depositClaims?: number;
        walletTransactions?: number;
        mgtTransactions?: number;
      };
    } | null;
    messages?: { createdAt: Date }[];
  },
): SupportTicketDTO {
  const user = row.user;
  const isDepositor =
    (user?._count?.depositClaims ?? 0) > 0 ||
    (user?._count?.walletTransactions ?? 0) > 0 ||
    (user?._count?.mgtTransactions ?? 0) > 0;

  return {
    id: row.id,
    userId: row.userId,
    username: user?.username ?? null,
    userEmail: user?.email ?? null,
    userWallet: user?.wallet ?? null,
    userIsDepositor: isDepositor,
    userHasClub: !!user?.club,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assignedTo,
    hasUnreadAdminReply: !!row.hasUnreadAdminReply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.messages?.[0]?.createdAt.toISOString() ?? null,
  };
}

function mapMessage(row: {
  id: string;
  ticketId: string;
  authorType: string;
  authorId: string;
  body: string;
  createdAt: Date;
  attachments?: {
    id: string;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
  }[];
}): SupportMessageDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorType: row.authorType as 'user' | 'admin',
    authorId: row.authorId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    attachments: (row.attachments ?? []).map(mapAttachment),
  };
}

const messageInclude = {
  attachments: {
    select: {
      id: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
    },
  },
} as const;

function assertContent(body: string, fileCount: number): void {
  if (!body.trim() && fileCount === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'message_or_image_required',
    });
  }
}

function assertFileCount(count: number): void {
  if (count > config.SUPPORT_UPLOAD_MAX_FILES) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, {
      reason: 'too_many_files',
      max: config.SUPPORT_UPLOAD_MAX_FILES,
    });
  }
}

async function persistImages(buffers: Buffer[]): Promise<SanitizedImageResult[]> {
  assertFileCount(buffers.length);
  const saved: SanitizedImageResult[] = [];
  try {
    for (const buffer of buffers) {
      saved.push(await saveSupportImage(buffer));
    }
    return saved;
  } catch (err) {
    for (const item of saved) {
      await deleteSupportImage(item.storageKey);
    }
    throw err;
  }
}

export class SupportService {
  constructor(private readonly prisma: PrismaClient) {}

  async createTicket(
    userId: string,
    data: { subject: string; category: string; message: string },
    imageBuffers: Buffer[] = [],
  ) {
    assertContent(data.message, imageBuffers.length);
    if (data.message.trim().length > 0 && data.message.trim().length < 5) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'message_too_short' });
    }

    const images = await persistImages(imageBuffers);

    try {
      const ticket = await this.prisma.supportTicket.create({
        data: {
          userId,
          subject: data.subject,
          category: data.category,
          messages: {
            create: {
              authorType: 'user',
              authorId: userId,
              body: data.message.trim(),
              attachments: {
                create: images.map((img) => ({
                  storageKey: img.storageKey,
                  mimeType: img.mimeType,
                  sizeBytes: img.sizeBytes,
                  width: img.width,
                  height: img.height,
                })),
              },
            },
          },
        },
        include: {
          user: { select: { username: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      return mapTicket(ticket);
    } catch (err) {
      for (const img of images) {
        await deleteSupportImage(img.storageKey);
      }
      throw err;
    }
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { username: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return rows.map(mapTicket);
  }

  async getTicketForUser(userId: string, ticketId: string): Promise<SupportTicketDetailDTO> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: {
        user: { select: { username: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: messageInclude,
        },
      },
    });
    if (!ticket) throw new AppError(ErrorCode.SUPPORT_TICKET_NOT_FOUND, 404);

    if (ticket.hasUnreadAdminReply) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { hasUnreadAdminReply: false },
      });
      ticket.hasUnreadAdminReply = false;
    }

    return {
      ...mapTicket({ ...ticket, messages: ticket.messages.slice(-1) }),
      messages: ticket.messages.map(mapMessage),
    };
  }

  async listUnreadForUser(userId: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId, hasUnreadAdminReply: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        user: { select: { username: true } },
        messages: {
          where: { authorType: 'admin' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return rows.map((row) => {
      const lastAdmin = row.messages[0];
      return {
        ...mapTicket(row),
        preview: lastAdmin?.body?.slice(0, 160) ?? '',
      };
    });
  }

  async addUserMessage(
    userId: string,
    ticketId: string,
    body: string,
    imageBuffers: Buffer[] = [],
  ) {
    assertContent(body, imageBuffers.length);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });
    if (!ticket) throw new AppError(ErrorCode.SUPPORT_TICKET_NOT_FOUND, 404);

    const images = await persistImages(imageBuffers);

    try {
      const msg = await this.prisma.supportMessage.create({
        data: {
          ticketId,
          authorType: 'user',
          authorId: userId,
          body: body.trim(),
          attachments: {
            create: images.map((img) => ({
              storageKey: img.storageKey,
              mimeType: img.mimeType,
              sizeBytes: img.sizeBytes,
              width: img.width,
              height: img.height,
            })),
          },
        },
        include: messageInclude,
      });
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date(), status: ticket.status === 'closed' ? 'open' : ticket.status },
      });
      return mapMessage(msg);
    } catch (err) {
      for (const img of images) {
        await deleteSupportImage(img.storageKey);
      }
      throw err;
    }
  }

  async getAttachmentForUser(userId: string, attachmentId: string) {
    const attachment = await this.prisma.supportAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            ticket: { select: { userId: true } },
          },
        },
      },
    });
    if (!attachment || attachment.message.ticket.userId !== userId) {
      throw new AppError(ErrorCode.SUPPORT_ATTACHMENT_NOT_FOUND, 404);
    }
    const file = await readSupportImage(attachment.storageKey);
    return { file, attachment: mapAttachment(attachment) };
  }

  async getAttachmentForAdmin(attachmentId: string) {
    const attachment = await this.prisma.supportAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new AppError(ErrorCode.SUPPORT_ATTACHMENT_NOT_FOUND, 404);
    }
    const file = await readSupportImage(attachment.storageKey);
    return { file, attachment: mapAttachment(attachment) };
  }

  async cleanupAttachmentsForMessage(messageId: string): Promise<void> {
    const attachments = await this.prisma.supportAttachment.findMany({
      where: { messageId },
      select: { storageKey: true },
    });
    await Promise.all(attachments.map((a) => deleteSupportImage(a.storageKey)));
  }

  async listAdmin(
    status?: string,
    limit = 50,
    cursor?: string,
    userFilters: AdminUserListFilters = {},
  ) {
    const userWhere = buildAdminUserWhere(userFilters);
    const rows = await this.prisma.supportTicket.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where: {
        ...(status ? { status } : {}),
        ...(Object.keys(userWhere).length > 0 ? { user: userWhere } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            email: true,
            wallet: true,
            club: { select: { name: true } },
            _count: {
              select: {
                depositClaims: { where: { status: 'credited' } },
                walletTransactions: { where: { type: 'usdc_deposit' } },
                mgtTransactions: { where: { type: 'usdc_deposit' } },
              },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      tickets: items.map(mapTicket),
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    };
  }

  async getTicketAdmin(ticketId: string): Promise<SupportTicketDetailDTO> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            username: true,
            email: true,
            wallet: true,
            club: { select: { name: true } },
            _count: {
              select: {
                depositClaims: { where: { status: 'credited' } },
                walletTransactions: { where: { type: 'usdc_deposit' } },
                mgtTransactions: { where: { type: 'usdc_deposit' } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: messageInclude,
        },
      },
    });
    if (!ticket) throw new AppError(ErrorCode.SUPPORT_TICKET_NOT_FOUND, 404);
    return {
      ...mapTicket({ ...ticket, messages: ticket.messages.slice(-1) }),
      messages: ticket.messages.map(mapMessage),
    };
  }

  async addAdminMessage(ticketId: string, adminLogin: string, body: string) {
    if (!body.trim()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'message_required' });
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(ErrorCode.SUPPORT_TICKET_NOT_FOUND, 404);

    const trimmed = body.trim();
    const msg = await this.prisma.supportMessage.create({
      data: { ticketId, authorType: 'admin', authorId: adminLogin, body: trimmed },
      include: messageInclude,
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        status: 'in_progress',
        assignedTo: adminLogin,
        hasUnreadAdminReply: true,
      },
    });
    return {
      message: mapMessage(msg),
      userId: ticket.userId,
      subject: ticket.subject,
      preview: trimmed.slice(0, 160),
      ticketId: ticket.id,
    };
  }

  async patchTicket(
    ticketId: string,
    data: Partial<{ status: string; priority: string; assignedTo: string | null }>,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(ErrorCode.SUPPORT_TICKET_NOT_FOUND, 404);

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.assignedTo !== undefined ? { assignedTo: data.assignedTo } : {}),
      },
      include: {
        user: { select: { username: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return mapTicket(updated);
  }
}
