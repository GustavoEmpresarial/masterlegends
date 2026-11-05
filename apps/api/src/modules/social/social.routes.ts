import type { FastifyInstance } from 'fastify';
import {
  socialApplySchema,
  socialProfilePatchSchema,
  socialVideoSubmitSchema,
} from '@mll/shared';
import { consumeMultipart } from '../../common/lib/multipart.js';
import { SocialService } from './social.service.js';

const uploadRateLimit = {
  max: 10,
  timeWindow: '1 hour',
};

export async function registerSocialRoutes(app: FastifyInstance) {
  const service = new SocialService(app.prisma);

  app.get(
    '/me',
    { schema: { tags: ['social'], security: [{ bearerAuth: [] }] } },
    async (request) => service.getMe(request.user.id),
  );

  app.post(
    '/apply',
    {
      schema: { tags: ['social'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: uploadRateLimit },
    },
    async (request) => {
      const { fields, files } = await consumeMultipart(request as never, { maxFiles: 1 });
      const parsed = socialApplySchema.parse({
        channelName: fields.channelName,
        channelUrl: fields.channelUrl,
        description: fields.description,
      });
      return service.apply(request.user.id, parsed, files[0]?.buffer ?? null);
    },
  );

  app.patch(
    '/profile',
    {
      schema: { tags: ['social'], security: [{ bearerAuth: [] }] },
      config: { rateLimit: uploadRateLimit },
    },
    async (request) => {
      const contentType = request.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        const { fields, files } = await consumeMultipart(request as never, { maxFiles: 1 });
        const parsed = socialProfilePatchSchema.parse({
          channelName: fields.channelName,
          description: fields.description,
        });
        return service.updateProfile(request.user.id, parsed, files[0]?.buffer ?? null);
      }
      const parsed = socialProfilePatchSchema.parse(request.body);
      return service.updateProfile(request.user.id, parsed, null);
    },
  );

  app.post(
    '/videos',
    { schema: { tags: ['social'], security: [{ bearerAuth: [] }] } },
    async (request) => {
      const body = socialVideoSubmitSchema.parse(request.body);
      return service.submitVideo(request.user.id, body.videoUrl);
    },
  );
}
