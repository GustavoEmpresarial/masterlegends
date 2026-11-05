import type { FastifyInstance } from 'fastify';
import { AdminPermission, officeStaffAvatarRoleSchema, officeStaffConfigPatchSchema } from '@mll/shared';
import { adminGuard, requireAdminPermission } from '../../common/guards/admin.guard.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { consumeMultipart } from '../../common/lib/multipart.js';
import { OfficeStaffConfigService } from './office-staff-config.service.js';

export async function registerOfficeAdminRoutes(app: FastifyInstance) {
  const service = new OfficeStaffConfigService(app.prisma);

  app.get(
    '/office-staff-config',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async () => service.get(),
  );

  app.patch(
    '/office-staff-config',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const body = officeStaffConfigPatchSchema.parse(request.body);
      return service.update(body, request.admin.login);
    },
  );

  app.post(
    '/office-staff-config/avatar',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const { fields, files } = await consumeMultipart(request as never, { maxFiles: 1 });
      const role = officeStaffAvatarRoleSchema.parse(fields.role);
      const file = files[0];
      if (!file) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'file_required' });
      }
      return service.uploadAvatar(role, file.buffer, file.mime, request.admin.login);
    },
  );

  app.delete(
    '/office-staff-config/avatar/:role',
    {
      preHandler: [adminGuard, requireAdminPermission(AdminPermission.MANAGE_STADIUMS)],
      schema: { tags: ['admin'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const role = officeStaffAvatarRoleSchema.parse((request.params as { role: string }).role);
      return service.clearAvatar(role, request.admin.login);
    },
  );
}
