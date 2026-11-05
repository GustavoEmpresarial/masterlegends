import { closeMongoSink } from '@mll/logging';
import { buildApp, config } from './app.js';
import { ChainService } from './modules/chain/chain.service.js';
import { setupSocketGateway } from './gateway/socket.js';
import { TelegramService } from './modules/telegram/telegram.service.js';
import { startTelegramPoller } from './modules/telegram/telegram.poller.js';
import { repriceActivePlayerStakes } from './modules/player-stake/player-stake.service.js';

async function main() {
  const app = await buildApp();
  const reprice = await repriceActivePlayerStakes(app.prisma);
  app.log.info(reprice, 'Active player stakes repriced to the current table');
  let stopTelegramPoller: (() => void) | undefined;

  try {
    await setupSocketGateway(app);
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`API listening on ${config.HOST}:${config.PORT}`);
    app.log.info(`WebSocket gateway listening on path ${config.SOCKET_PATH}`);

    if (!config.isTest && (config.CONTRACT_PLAYER_NFT || config.CONTRACT_USDC_VAULT)) {
      const chainService = new ChainService(app.redisQueue);
      void chainService.startListening().catch((err) => {
        app.log.error({ err }, 'Chain listener failed to start');
      });
    }

    if (!config.isTest && config.TELEGRAM_ENABLED) {
      const telegram = new TelegramService(app.prisma, app.redis, app.redisQueue);
      stopTelegramPoller = startTelegramPoller(telegram);
    }
  } catch (err) {
    app.log.error({ err }, 'Failed to start API');
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    stopTelegramPoller?.();
    await app.close();
    await closeMongoSink();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
