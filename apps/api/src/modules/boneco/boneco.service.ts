import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { MgtTxType, readPlayerAttributes, type PlayerAttributes } from '@mll/shared';
import { config } from '../../config/env.js';
import { applyUsdcDebit } from '../wallet/mgt-ledger.js';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import { deleteBonecoImage, saveBonecoImage } from '../../common/lib/uploads.js';
import {
  bonecoRarityFromIndex,
  buildBonecoPrompt,
  extractBonecoImageBase64,
  sanitizeBonecoNote,
  type BonecoCardStats,
  type BonecoSpec,
} from './boneco.prompt.js';

export type BonecoPlayerKind = 'base' | 'nft';

const BONECO_USDC_COST = 1;

let referenceDataUrl: string | null | undefined;

function bonecoReferenceDataUrl(): string | null {
  if (referenceDataUrl !== undefined) return referenceDataUrl;
  try {
    const path = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/boneco-card.jpg');
    const bytes = readFileSync(path);
    referenceDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  } catch {
    referenceDataUrl = null;
  }
  return referenceDataUrl;
}

function imageRequestBody(model: string, prompt: string): Record<string, unknown> {
  const body: Record<string, unknown> = { model, prompt, aspect_ratio: '3:4' };
  if (model.startsWith('bytedance-seed/seedream')) {
    body.resolution = '1K';
    const reference = bonecoReferenceDataUrl();
    if (reference) {
      body.input_references = [{ type: 'image_url', image_url: { url: reference } }];
    }
  }
  return body;
}

export interface BonecoLookDTO {
  playerId: string;
  playerKind: BonecoPlayerKind;
  imageUrl: string;
  position: string;
  kit: string;
  trim: string;
  pose: string;
  note: string;
  updatedAt: string;
}

export class BonecoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private imageModels(): string[] {
    const models = config.OPENROUTER_IMAGE_MODEL.split(',')
      .map((model) => model.trim())
      .filter(Boolean);
    return models.length > 0 ? models : ['bytedance-seed/seedream-5-0-flash'];
  }

  private async requestImage(prompt: string): Promise<Buffer | null> {
    let sawHttpError = false;
    for (const model of this.imageModels()) {
      const response = await this.fetchImpl('https://openrouter.ai/api/v1/images', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(imageRequestBody(model, prompt)),
        signal: AbortSignal.timeout(90_000),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        sawHttpError = true;
        continue;
      }
      const b64 = extractBonecoImageBase64(payload);
      if (b64) return Buffer.from(b64, 'base64');
    }
    if (sawHttpError) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'openrouter_failed' });
    }
    return null;
  }

  async listMine(userId: string): Promise<BonecoLookDTO[]> {
    const rows = await this.prisma.bonecoLook.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async generate(
    userId: string,
    spec: BonecoSpec & { playerId: string; playerKind: BonecoPlayerKind },
  ): Promise<BonecoLookDTO> {
    if (!config.OPENROUTER_API_KEY) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'openrouter_not_configured' });
    }

    const owned = await this.ownedPlayer(userId, spec.playerKind, spec.playerId);
    const note = sanitizeBonecoNote(spec.note ?? '');
    const position = spec.position;
    const kit = spec.kit ?? 'verde';
    const trim = spec.trim ?? 'branco';
    const pose = spec.pose ?? 'parado';

    const balance = await this.prisma.mGTBalance.findUnique({
      where: { userId },
      select: { usdcAmount: true },
    });
    const currentUsdc = Number(balance?.usdcAmount ?? 0);
    if (currentUsdc < BONECO_USDC_COST) {
      throw new AppError(ErrorCode.INSUFFICIENT_USDC, 400, {
        required: BONECO_USDC_COST,
        current: currentUsdc,
      });
    }

    const image = await this.requestImage(buildBonecoPrompt({
      position,
      kit: spec.kit,
      trim: spec.trim,
      pose: spec.pose,
      note,
      playerName: owned.name,
      rarity: owned.rarity,
      stats: cardStats(owned.attributes),
    }));
    if (!image) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'openrouter_no_image' });
    }

    const saved = await saveBonecoImage(image);
    const where = {
      userId_playerKind_playerId: {
        userId,
        playerKind: spec.playerKind,
        playerId: spec.playerId,
      },
    };
    const previous = await this.prisma.bonecoLook.findUnique({
      where,
      select: { imageUrl: true },
    });

    let row;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await applyUsdcDebit(tx, userId, BONECO_USDC_COST, MgtTxType.BONECO, {
          playerId: spec.playerId,
          playerKind: spec.playerKind,
        });
        if (spec.playerKind === 'base') {
          await tx.basePlayer.update({
            where: { id: spec.playerId },
            data: {
              imageUrl: saved.url,
              ...(owned.attributesStored ? {} : { attributes: owned.attributes }),
            },
          });
        }
        return tx.bonecoLook.upsert({
          where,
          create: {
            userId,
            playerId: spec.playerId,
            playerKind: spec.playerKind,
            imageUrl: saved.url,
            position,
            kit,
            trim,
            pose,
            note,
          },
          update: {
            imageUrl: saved.url,
            position,
            kit,
            trim,
            pose,
            note,
          },
        });
      });
    } catch (error) {
      await deleteBonecoImage(saved.url);
      throw error;
    }

    if (previous && previous.imageUrl !== saved.url) {
      await deleteBonecoImage(previous.imageUrl);
    }

    return this.toDto(row);
  }

  private toDto(row: {
    playerId: string;
    playerKind: string;
    imageUrl: string;
    position: string;
    kit: string;
    trim: string;
    pose: string;
    note: string;
    updatedAt: Date;
  }): BonecoLookDTO {
    return {
      playerId: row.playerId,
      playerKind: row.playerKind === 'nft' ? 'nft' : 'base',
      imageUrl: row.imageUrl,
      position: row.position,
      kit: row.kit,
      trim: row.trim,
      pose: row.pose,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async ownedPlayer(
    userId: string,
    kind: BonecoPlayerKind,
    playerId: string,
  ): Promise<{
    name: string | null;
    rarity: ReturnType<typeof bonecoRarityFromIndex>;
    rarityIndex: number;
    attributes: PlayerAttributes;
    attributesStored: boolean;
  }> {
    if (kind === 'base') {
      const player = await this.prisma.basePlayer.findFirst({
        where: { id: playerId, userId, retiredAt: null },
        select: { name: true, rarity: true, position: true, attributes: true, template: { select: { name: true } } },
      });
      if (!player) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'player_not_owned' });
      }
      return {
        name: player.name ?? player.template?.name ?? null,
        rarity: bonecoRarityFromIndex(player.rarity),
        rarityIndex: player.rarity,
        attributes: readPlayerAttributes(player.attributes, playerId, player.rarity, player.position),
        attributesStored: player.attributes != null,
      };
    }

    if (!/^\d+$/.test(playerId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'player_not_owned' });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { wallet: true },
    });
    const wallet = user?.wallet?.trim();
    if (!wallet) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'player_not_owned' });
    }
    const nft = await this.prisma.playerCache.findFirst({
      where: {
        tokenId: BigInt(playerId),
        ownerWallet: { in: [wallet, wallet.toLowerCase()] },
      },
      select: { tokenId: true, rarity: true, position: true, attributes: true },
    });
    if (!nft) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, { reason: 'player_not_owned' });
    }
    return {
      name: null,
      rarity: bonecoRarityFromIndex(nft.rarity),
      rarityIndex: nft.rarity,
      attributes: readPlayerAttributes(nft.attributes, playerId, nft.rarity, nft.position),
      attributesStored: nft.attributes != null,
    };
  }
}

function cardStats(attributes: PlayerAttributes): BonecoCardStats {
  return {
    strength: attributes.forca,
    speed: attributes.velocidade,
    stamina: attributes.resistencia,
    performance: attributes.tecnica,
  };
}
