import type { FastifyInstance } from 'fastify';
import { StatsService } from './stats.service.js';
import { SocialService } from '../social/social.service.js';

export async function registerStatsRoutes(app: FastifyInstance) {
  const service = new StatsService(app.prisma);
  const social = new SocialService(app.prisma);

  app.get(
    '/public',
    {
      schema: {
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              registeredUsers: { type: 'number' },
              totalDepositedUsd: { type: 'number' },
              nftsMinted: { type: 'number' },
              launchedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async () => service.getPublicStats(),
  );

  app.get(
    '/public/wallet-activity',
    {
      schema: {
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              deposits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amountUsdc: { type: 'number' },
                    txHash: { type: 'string' },
                    walletMasked: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                  },
                },
              },
              withdrawals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amountUsdc: { type: 'number' },
                    txHash: { type: 'string' },
                    walletMasked: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => service.getPublicWalletActivity(),
  );

  app.get(
    '/ranking/clubs',
    {
      schema: {
        tags: ['stats'],
        response: {
          200: {
            type: 'object',
            properties: {
              clubs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number' },
                    clubName: { type: 'string' },
                    username: { type: 'string' },
                    totalOverwall: { type: 'number' },
                    stadiumLvl: { type: 'number' },
                    stadiumName: { type: ['string', 'null'] },
                    stadiumImageUrl: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => service.getClubRanking(),
  );

  app.get(
    '/ranking/clubs/:clubName',
    {
      schema: {
        tags: ['stats'],
        params: {
          type: 'object',
          properties: { clubName: { type: 'string' } },
          required: ['clubName'],
        },
      },
    },
    async (req) => {
      const { clubName } = req.params as { clubName: string };
      return service.getClubRankingProfile(clubName);
    },
  );

  app.get(
    '/ranking/players',
    {
      schema: {
        tags: ['stats'],
      },
    },
    async () => service.getPlayerRanking(),
  );

  app.get(
    '/social/videos',
    { schema: { tags: ['stats'] } },
    async () => social.getPublicFeed(),
  );
}
