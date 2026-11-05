import 'fastify';
import type { CookieSerializeOptions } from '@fastify/cookie';

declare module 'fastify' {

  interface FastifySchema {
    tags?: string[];
    security?: Array<Record<string, string[]>>;
  }

  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
  }

  interface FastifyReply {
    setCookie(name: string, value: string, options?: CookieSerializeOptions): this;
    clearCookie(name: string, options?: CookieSerializeOptions): this;
    generateCsrf(): Promise<string>;
  }
}
