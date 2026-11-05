import type { FastifyInstance } from 'fastify';
import { renameClubSchema } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { consumeMultipart } from '../../common/lib/multipart.js';
import { ProfileService } from './profile.service.js';

const avatarRateLimit = {
  max: 20,
  timeWindow: '1 hour',
};

export async function registerProfileRoutes(app: FastifyInstance) {
  const service = new ProfileService(app.prisma);

  app.get(
    '/',
    { schema: { tags: ['profile'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getProfile(request.user.id),
  );

  app.post(
    '/avatar',
    {
      schema: { tags: ['profile'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: avatarRateLimit },
    },
    async (request) => {
      const { files } = await consumeMultipart(request as never, { maxFiles: 1 });
      const file = files[0];
      if (!file) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'file_required' });
      }
      return service.updateAvatar(request.user.id, file.buffer);
    },
  );

  app.delete(
    '/avatar',
    { schema: { tags: ['profile'], security: [{ bearerAuth: [] }] } },
    async (request) => service.clearAvatar(request.user.id),
  );

  app.patch(
    '/club-name',
    { schema: { tags: ['profile'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = renameClubSchema.parse(request.body);
      return service.renameClub(request.user.id, body.name);
    },
  );
}
