export interface ClubRankingEntryDTO {
  rank: number;
  clubName: string;
  username: string;
  totalOverwall: number;
  stadiumLvl: number;
  stadiumName: string | null;
  stadiumImageUrl: string | null;
}

export interface ClubRankingDTO {
  clubs: ClubRankingEntryDTO[];
}

export interface RankingPlayerPreviewDTO {
  id: string;
  name: string;
  position: string;
  rarity: string;
  overwall: number;
  imageUrl: string | null;
  kind: 'base' | 'nft';
}

export interface ClubRankingFieldSlotDTO {
  slot: {
    id: string;
    label: string;
    xPct: number;
    yPct: number;
    role?: string;
    zIndex?: number;
  };
  player: RankingPlayerPreviewDTO | null;
}

export interface ClubRankingProfileDTO {
  rank: number;
  clubName: string;
  username: string;
  totalOverwall: number;
  playerCount: number;
  stadiumLvl: number;
  ctLvl: number;
  treasurerLvl: number;
  trophyRoomLvl: number;
  createdAt: string;
  stadiumName: string;
  stadiumImageUrl: string;
  fieldSlots: ClubRankingFieldSlotDTO[];
  topPlayers: RankingPlayerPreviewDTO[];
}

export interface PlayerRankingEntryDTO {
  rank: number;
  playerName: string;
  position: string;
  rarity: string;
  overwall: number;
  imageUrl: string | null;
  clubName: string | null;
  username: string | null;
}

export interface PlayerRankingDTO {
  players: PlayerRankingEntryDTO[];
}
