import { ethers } from 'ethers';
import type Redis from 'ioredis';
import {
  ChainEvent,
  ERC20_TRANSFER_TOPIC,
  encodeLogTopicAddress,
  getPolygonUsdcAddresses,
  parseTreasuryTransferTopicLog,
} from '@mll/shared';
import { config } from '../../config/env.js';
import { JobQueues } from '../../common/lib/queues.js';
import { logger } from '../../common/lib/logger.js';

const PLAYER_NFT_ABI = [
  'event PlayerMinted(uint256 indexed tokenId, address indexed owner, uint8 rarity, uint32 overwall, uint8 position)',
  'event PlayerBurned(uint256 indexed tokenId)',
  'event StaminaUpdated(uint256 indexed tokenId, uint8 oldStamina, uint8 newStamina)',
];

const MARKETPLACE_ABI = [
  'event ItemListed(uint256 indexed listingId, uint256 indexed tokenId, address seller, uint256 price)',
  'event ItemSold(uint256 indexed listingId, uint256 indexed tokenId, address buyer, uint256 price, uint256 fee)',
  'event ListingCancelled(uint256 indexed listingId)',
];

const BURN_ENGINE_ABI = [
  'event PlayersFused(address indexed owner, uint256[5] burnedIds, uint256 newTokenId, uint8 newRarity, uint32 newOverwall)',
];

const TREASURY_POLL_INTERVAL_MS = 15_000;
const TREASURY_POLL_BLOCK_CHUNK = 2_000;
const TREASURY_POLL_LOOKBACK = 500;

export class ChainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private isListening = false;
  private treasuryPollTimer: ReturnType<typeof setInterval> | null = null;
  private treasuryPollInFlight = false;
  private readonly queues: JobQueues;

  constructor(redis: Redis) {
    this.queues = new JobQueues(redis);
  }

  async startListening() {
    if (this.isListening) return;

    const rpcUrl = config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
    if (!rpcUrl) {
      logger.warn('Chain listener skipped: no RPC URL configured');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const blockNumber = await this.provider.getBlockNumber();
    const previousCheckpoint = await this.queues.getBlockCheckpoint();
    await this.queues.saveBlockCheckpoint(blockNumber);

    logger.info(
      {
        event: 'chain.listener.start',
        blockNumber,
        previousCheckpoint,
      },
      'Chain listener started',
    );

    if (config.CONTRACT_PLAYER_NFT) {
      const playerNFT = new ethers.Contract(
        config.CONTRACT_PLAYER_NFT,
        PLAYER_NFT_ABI,
        this.provider,
      );

      playerNFT.on(ChainEvent.PlayerMinted, async (tokenId, owner, rarity, overwall, position) => {
        await this.recordEvent(ChainEvent.PlayerMinted, {
          tokenId: tokenId.toString(),
          owner: String(owner),
          rarity: Number(rarity),
          overwall: Number(overwall),
          position: Number(position),
        });
      });

      playerNFT.on(ChainEvent.PlayerBurned, async (tokenId) => {
        await this.recordEvent(ChainEvent.PlayerBurned, {
          tokenId: tokenId.toString(),
        });
      });
    }

    if (config.CONTRACT_MARKETPLACE) {
      const marketplace = new ethers.Contract(
        config.CONTRACT_MARKETPLACE,
        MARKETPLACE_ABI,
        this.provider,
      );

      marketplace.on(ChainEvent.ItemListed, async (listingId, tokenId, seller, price) => {
        await this.recordEvent(ChainEvent.ItemListed, {
          listingId: listingId.toString(),
          tokenId: tokenId.toString(),
          seller: String(seller),
          price: price.toString(),
        });
      });

      marketplace.on(ChainEvent.ItemSold, async (listingId, tokenId, buyer, price, fee) => {
        await this.recordEvent(ChainEvent.ItemSold, {
          listingId: listingId.toString(),
          tokenId: tokenId.toString(),
          buyer: String(buyer),
          price: price.toString(),
          fee: fee.toString(),
        });
      });
    }

    if (config.CONTRACT_BURN) {
      const burnEngine = new ethers.Contract(
        config.CONTRACT_BURN,
        BURN_ENGINE_ABI,
        this.provider,
      );

      burnEngine.on(ChainEvent.PlayersFused, async (owner, burnedIds, newTokenId, newRarity, newOverwall) => {
        await this.recordEvent(ChainEvent.PlayersFused, {
          owner: String(owner),
          burnedIds: burnedIds.map((id: bigint) => id.toString()),
          newTokenId: newTokenId.toString(),
          newRarity: Number(newRarity),
          newOverwall: Number(newOverwall),
        });
      });
    }

    if (config.CONTRACT_USDC_VAULT && config.USDC_ADDRESS) {
      this.startTreasuryDepositPolling();
    }

    this.isListening = true;
  }

  private startTreasuryDepositPolling() {
    if (this.treasuryPollTimer) return;

    void this.pollTreasuryDepositsOnce().catch((err) => {
      logger.warn({ err, event: 'chain.treasury_poll.error' }, 'Treasury deposit poll failed');
    });

    this.treasuryPollTimer = setInterval(() => {
      void this.pollTreasuryDepositsOnce().catch((err) => {
        logger.warn({ err, event: 'chain.treasury_poll.error' }, 'Treasury deposit poll failed');
      });
    }, TREASURY_POLL_INTERVAL_MS);
  }

  private async pollTreasuryDepositsOnce() {
    if (this.treasuryPollInFlight || !this.provider) return;
    this.treasuryPollInFlight = true;

    try {
      const treasury = config.CONTRACT_USDC_VAULT!.toLowerCase();
      const usdcContracts = getPolygonUsdcAddresses(config.USDC_ADDRESS);
      const latest = await this.provider.getBlockNumber();
      const stored = await this.queues.getTreasuryPollCheckpoint();
      let fromBlock = stored != null ? stored + 1 : Math.max(0, latest - TREASURY_POLL_LOOKBACK);

      if (fromBlock > latest) {
        return;
      }

      let matched = 0;

      while (fromBlock <= latest) {
        const toBlock = Math.min(fromBlock + TREASURY_POLL_BLOCK_CHUNK - 1, latest);
        const logs = await this.provider.getLogs({
          address: usdcContracts,
          topics: [ERC20_TRANSFER_TOPIC, null, encodeLogTopicAddress(treasury)],
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const parsed = parseTreasuryTransferTopicLog(log.topics as string[], log.data, treasury);
          if (!parsed) continue;
          matched += 1;
          await this.recordEvent(ChainEvent.UsdcDeposited, {
            user: parsed.wallet,
            amount: parsed.amount.toString(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }

        await this.queues.saveTreasuryPollCheckpoint(toBlock);
        fromBlock = toBlock + 1;
      }

    } finally {
      this.treasuryPollInFlight = false;
    }
  }

  private async recordEvent(event: string, data: Record<string, unknown>) {
    await this.queues.enqueueChainEvent(event, data);
    if (this.provider) {
      const block = await this.provider.getBlockNumber();
      await this.queues.saveBlockCheckpoint(block);
    }
  }
}
