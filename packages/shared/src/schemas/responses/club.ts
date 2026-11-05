export interface ClubDataDTO {
  id: string;
  name: string;
  stadiumLvl: number;
  ctLvl: number;
  treasurerLvl: number;
  trophyRoomLvl: number;
  totalOverwall: number;
  /** Soma dos jogadores elegíveis: não aposentados e não à venda. */
  squadOverwall?: number;
  /** Poder dos titulares com stamina, na posição certa. */
  activeOverwall?: number;
  /** Soma da coleção inteira, inclusive banco, à venda e aposentados. */
  collectionOverwall?: number;
  gmtBalance: number;
  usdcBalance: number;
  usdtBalance: number;
  nftCount: number;
  basePlayerCount: number;
  usdcPerHour: number;
  pendingFarmUsdc: number;
  lineupOverwall?: number;
  estimatedUsdcPerRound?: number;
  sharePct?: number;
  /** Aba do estádio aberta no momento da consulta. */
  stadiumWatching?: boolean;
  /** 1 com a aba aberta, 0.7 fechado ou offline. */
  presenceRate?: number;
}
