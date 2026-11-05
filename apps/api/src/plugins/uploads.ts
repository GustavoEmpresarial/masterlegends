import path from 'node:path';
import { promises as fs } from 'node:fs';
import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { VESTIARIO_VIDEO_MAX_BYTES } from '@mll/shared';
import { config } from '../config/env.js';

export default fp(async (app: FastifyInstance) => {
  await app.register(multipart, {
    limits: {
      fileSize: Math.max(config.UPLOAD_MAX_BYTES, VESTIARIO_VIDEO_MAX_BYTES),
      files: Math.max(config.SUPPORT_UPLOAD_MAX_FILES, 5),
    },
  });

  const root = path.resolve(config.UPLOADS_DIR);
  const privateRoot = path.resolve(config.PRIVATE_UPLOADS_DIR);
  await fs.mkdir(path.join(root, 'items'), { recursive: true });
  await fs.mkdir(path.join(root, 'stadiums'), { recursive: true });
  await fs.mkdir(path.join(root, 'office'), { recursive: true });
  await fs.mkdir(path.join(root, 'vestiario'), { recursive: true });
  await fs.mkdir(path.join(privateRoot, 'support'), { recursive: true });
  await fs.mkdir(path.join(root, 'blog'), { recursive: true });
  await fs.mkdir(path.join(root, 'notices'), { recursive: true });
  await fs.mkdir(path.join(root, 'transparency'), { recursive: true });
  await fs.mkdir(path.join(root, 'shop'), { recursive: true });

  // Servir imagem estática não deve consumir a mesma cota de rate limit das rotas de API —
  // uma página com várias fotos (elenco, marketplace) facilmente dispara dezenas de requests.
  // Precisa vir ANTES do register do fastifyStatic (onRoute só pega rotas registradas depois).
  app.addHook('onRoute', (route) => {
    if (route.path.startsWith(`${config.UPLOADS_PUBLIC_PATH}/`)) {
      route.config = { ...(route.config as object), rateLimit: false } as typeof route.config;
    }
  });

  await app.register(fastifyStatic, {
    root,
    prefix: `${config.UPLOADS_PUBLIC_PATH}/`,
    decorateReply: false,
    serve: true,
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
});
