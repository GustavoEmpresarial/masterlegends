export interface ProfileLineupPlayerDTO {
  id: string;
  name: string;
  position: string;
  overwall: number;
}

export interface ProfileTransactionDTO {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  source: 'gmt' | 'wallet';
}

export interface ProfileMatchDTO {
  id: string;
  playedAt: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
}

export interface PlayerProfileDTO {
  account: {
    id: string;
    wallet: string | null;
    name: string | null;
    avatarInitials: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  club: {
    id: string;
    name: string;
    createdAt: string;
    stadiumLvl: number;
    overwall: number;
    squadOverwall: number;
    activeOverwall: number;
    collectionOverwall: number;
  };
  players: {
    baseCount: number;
    nftCount: number;
    lineupCount: number;
    inventoryCount: number;
    lineup: ProfileLineupPlayerDTO[];
  };
  finance: {
    gmt: number;
    usdc: number;
    usdt: number;
    transactions: ProfileTransactionDTO[];
  };
  gameplay: {
    seasonName: string | null;
    seasonActive: boolean;
    passXp: number;
    passLevel: number;
    passPremium: boolean;
    trophyCount: number;
    badgeCount: number;
    matches: ProfileMatchDTO[];
  };
}
