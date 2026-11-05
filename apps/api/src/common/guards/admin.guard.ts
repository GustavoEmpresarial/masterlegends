import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { AdminPermissionType, AdminRoleType } from '@mll/shared';
import { adminHasPermission, AdminRole, ErrorCode, serializeError } from '@mll/shared';
import { findAdminById } from '../../modules/admin/admin.config.js';
import { getAdminJwt } from '../../modules/admin/admin-jwt.js';
import { authorizeAdmin } from '../lib/prisma-context.js';
import { AdminPermissionConfigService } from '../../modules/admin/admin-permission-config.service.js';

export interface AdminUser {
  id: string;
  login: string;
  role: AdminRoleType;
  email?: string;
}

export interface AdminAccessClaims {
  sub: string;
  login: string;
  role: AdminRoleType;
  email?: string;
  type?: 'admin' | 'admin-refresh';
}

declare module 'fastify' {
  interface FastifyRequest {
    admin: AdminUser;
  }
}

function adminTokensFromRequest(request: FastifyRequest): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of [extractAdminToken(request), request.cookies?.admin_access]) {
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  const tokens = adminTokensFromRequest(request);
  if (tokens.length === 0) {
    return reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
  }

  for (const token of tokens) {
    try {
      const decoded = getAdminJwt(request.server).verify<AdminAccessClaims>(token);
      if (decoded.type !== 'admin') continue;
      if (!findAdminById(decoded.sub)) continue;

      request.admin = {
        id: decoded.sub,
        login: decoded.login,
        role: decoded.role,
        email: decoded.email,
      };
      // Libera queries Prisma no scope admin (contexto iniciado no onRequest)
      authorizeAdmin(decoded.sub);
      return;
    } catch {
      /* try next token (e.g. expired Bearer + fresh cookie) */
    }
  }

  return reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
}

export function requireAdminPermission(permission: AdminPermissionType): preHandlerHookHandler {
  return async (request, reply) => {
    if (!request.admin) {
      return reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
    }

    // Super admins always have full access
    if (request.admin.role === AdminRole.SUPER) return;

    // Check per-admin permission config in DB (with Redis cache)
    const permService = new AdminPermissionConfigService(
      request.server.prisma,
      request.server.redisQueue,
    );
    const dbPerms = await permService.getPermissions(request.admin.id);

    if (dbPerms !== null) {
      if (!dbPerms.includes(permission)) {
        return reply.status(403).send(serializeError(ErrorCode.ADMIN_FORBIDDEN, 403));
      }
      return;
    }

    // No DB config: fall back to hardcoded role matrix
    if (!adminHasPermission(request.admin.role, permission)) {
      return reply.status(403).send(serializeError(ErrorCode.ADMIN_FORBIDDEN, 403));
    }
  };
}

export function requireAdminRole(...roles: AdminRoleType[]): preHandlerHookHandler {
  return async (request, reply) => {
    if (!request.admin) {
      return reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
    }
    if (!roles.includes(request.admin.role)) {
      return reply.status(403).send(serializeError(ErrorCode.ADMIN_FORBIDDEN, 403));
    }
  };
}

export function extractAdminToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookie = request.cookies?.admin_access;
  return cookie || undefined;
}

export async function verifyAdminTokenForBoard(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedRoles: AdminRoleType[],
): Promise<boolean> {
  const token = extractAdminToken(request);
  if (!token) {
    reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
    return false;
  }

  try {
    const decoded = getAdminJwt(request.server).verify<AdminAccessClaims>(token);
    if (decoded.type !== 'admin' || !allowedRoles.includes(decoded.role)) {
      reply.status(403).send(serializeError(ErrorCode.ADMIN_FORBIDDEN, 403));
      return false;
    }
    request.admin = {
      id: decoded.sub,
      login: decoded.login,
      role: decoded.role,
      email: decoded.email,
    };
    authorizeAdmin(decoded.sub);
    return true;
  } catch {
    reply.status(401).send(serializeError(ErrorCode.ADMIN_UNAUTHORIZED, 401));
    return false;
  }
}
