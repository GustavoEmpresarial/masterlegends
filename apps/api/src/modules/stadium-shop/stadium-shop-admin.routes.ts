import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { AdminPermission, stadiumShopItemCreateSchema, stadiumShopItemPatchSchema } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError } from '../../common/lib/errors.js';
import { ErrorCode } from '@mll/shared';
import { saveGearImage, saveShopImage } from '../../common/lib/uploads.js';
import { ClubRepository } from '../club/club.repository.js';
import { GearService } from './gear.service.js';
import { StadiumShopService } from './stadium-shop.service.js';

export async function registerStadiumShopAdminRoutes(app: FastifyInstance) {
  const clubRepo = new ClubRepository(app.prisma);
  const service = new StadiumShopService(app.prisma, clubRepo);
  const gear = new GearService(app.prisma, clubRepo);
  const pre = [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)];

  app.get('/stadium-shop/items', { preHandler: pre }, async () => {
    const items = await service.listAll();
    return { items };
  });

  app.post('/stadium-shop/items', { preHandler: pre }, async (request) => {
    const body = stadiumShopItemCreateSchema.parse(request.body);
    const item = await service.createItem(body);
    return { item };
  });

  app.post('/stadium-shop/upload-image', { preHandler: pre }, async (request) => {
    const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
    if (!data) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
    const buffer = await data.toBuffer();
    const { url } = await saveShopImage(buffer, data.mimetype);
    return { url };
  });

  app.patch('/stadium-shop/items/:id', { preHandler: pre }, async (request) => {
    const { id } = request.params as { id: string };
    const body = stadiumShopItemPatchSchema.parse(request.body);
    const item = await service.patchItem(id, body);
    return { item };
  });

  app.get('/stadium-shop/gear', { preHandler: pre }, async () => {
    const items = await gear.listAllCatalog();
    return { items };
  });

  app.post('/stadium-shop/gear', { preHandler: pre }, async (request) => {
    const item = await gear.createCatalog(request.body);
    return { item };
  });

  app.patch('/stadium-shop/gear/:id', { preHandler: pre }, async (request) => {
    const { id } = request.params as { id: string };
    const item = await gear.patchCatalog(id, request.body);
    return { item };
  });

  app.post('/stadium-shop/upload-gear-image', { preHandler: pre }, async (request) => {
    const data = await (request as FastifyRequest & { file: () => Promise<MultipartFile> }).file();
    if (!data) throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
    const buffer = await data.toBuffer();
    if (!buffer.byteLength) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'empty_file' });
    }
    const { url } = await saveGearImage(buffer);
    return { url };
  });
}
