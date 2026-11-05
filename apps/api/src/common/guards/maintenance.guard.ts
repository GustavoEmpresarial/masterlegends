import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode, serializeError } from '@mll/shared';
import { runWithSystemContext } from '../lib/prisma-context.js';

const CACHE_TTL_MS = 3000;

interface MaintenanceState {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  expiresAt: number;
}

let cached: MaintenanceState | null = null;

const FALLBACK_STATE: MaintenanceState = { maintenanceMode: false, maintenanceMessage: null, expiresAt: 0 };

async function getMaintenanceState(request: FastifyRequest): Promise<MaintenanceState> {
  if (cached && cached.expiresAt > Date.now()) return cached;

  try {
    // O callback precisa dar `await` na query aqui dentro — `storage.run()` só mantém o
    // contexto ALS ativo durante a execução síncrona do callback; como o Prisma usa
    // PrismaPromise (thenable custom, não Promise nativa), a query em si só roda de fato
    // no `.then()`. Sem o `await` explícito aqui, ela executa fora do contexto 'system'
    // e cai no fail-closed do isPrismaAccessAllowed() (mesmo bug que os outros call sites
    // de runWithSystemContext no repo já evitam awaitando dentro do callback).
    const row = await runWithSystemContext(async () =>
      await request.server.prisma.platformConfig.findUnique({
        where: { id: 'default' },
        select: { maintenanceMode: true, maintenanceMessage: true },
      }),
    );

    cached = {
      maintenanceMode: row?.maintenanceMode ?? false,
      maintenanceMessage: row?.maintenanceMessage ?? null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return cached;
  } catch (err) {
    // Fail-open: um guard que roda em toda request não pode derrubar o site inteiro
    // por causa de um erro transitório de DB.
    request.log.error({ err }, 'maintenanceGuard: falha ao ler PlatformConfig, seguindo sem bloquear');
    return FALLBACK_STATE;
  }
}

const BYPASS_PREFIXES = ['/health', '/admin/api', '/uploads/', '/auth/stadium-live', '/socket.io'];

/** Sessão e o campo do widget Taskbar Hero. O resto da API pública continua bloqueado. */
const BYPASS_EXACT = new Set([
  '/auth/csrf',
  '/auth/refresh',
  '/auth/me',
  '/auth/login',
  '/api/stadium/view',
]);

function requestPath(url: string): string {
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}

// Manutenção só derruba o domínio principal — dev/staging/localhost/IP direto sempre
// passam, independente do flag. Depende do futuro vhost de dev.masterlegends.online
// preservar o header Host (proxy_set_header Host $host;), como os vhosts atuais já fazem.
const ENFORCED_HOSTNAMES = new Set(['masterlegends.online', 'www.masterlegends.online']);

/**
 * Derruba toda a API pública (auth, /api/*, blog, transparência etc.) quando
 * PlatformConfig.maintenanceMode está ligado. /health, /admin/api e /uploads/
 * ficam de fora pra checar liveness, operar o painel e carregar as fotos
 * (estádio, itens) que o admin acabou de publicar. Só gateia o
 * domínio principal — outros hosts (dev, localhost) passam direto.
 * Cache curto (3s) evita 1 SELECT por request sem atrasar a propagação do toggle.
 */
export async function maintenanceGuard(request: FastifyRequest, reply: FastifyReply) {
  const path = requestPath(request.url);
  if (BYPASS_EXACT.has(path) || BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  if (!ENFORCED_HOSTNAMES.has(request.hostname)) return;

  const state = await getMaintenanceState(request);
  if (!state.maintenanceMode) return;

  return reply.status(503).send(
    serializeError(ErrorCode.MAINTENANCE_MODE, 503, {
      message: state.maintenanceMessage ?? 'Plataforma em manutenção. Voltamos em breve.',
    }),
  );
}
