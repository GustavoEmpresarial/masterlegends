import type { FastifyInstance } from 'fastify';
import { runWithSystemContext } from '../../src/common/lib/prisma-context.js';

/** Register → mark email verified → login. Returns access token. */
export async function registerVerifyAndLogin(
  app: FastifyInstance,
  opts: { email: string; username: string; password?: string },
): Promise<string> {
  const password = opts.password ?? 'Test.1!pass';
  const reg = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: opts.email,
      username: opts.username,
      password,
      acceptTerms: true,
    },
  });
  if (reg.statusCode !== 201 && reg.statusCode !== 200) {
    throw new Error(`register failed: ${reg.statusCode} ${reg.body}`);
  }

  await runWithSystemContext(async () => {
    await app.prisma.user.update({
      where: { email: opts.email },
      data: { emailVerifiedAt: new Date() },
    });
  });

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: opts.email, password },
  });
  if (login.statusCode !== 200) {
    throw new Error(`login failed: ${login.statusCode} ${login.body}`);
  }
  return login.json().accessToken as string;
}
