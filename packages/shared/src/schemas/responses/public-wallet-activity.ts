export interface PublicWalletActivityItemDTO {
  id: string;
  amountUsdc: number;
  txHash: string;
  walletMasked: string | null;
  createdAt: string;
}

export interface PublicWalletActivityDTO {
  deposits: PublicWalletActivityItemDTO[];
  withdrawals: PublicWalletActivityItemDTO[];
}
