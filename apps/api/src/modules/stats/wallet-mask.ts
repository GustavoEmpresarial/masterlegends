/** Mascara endereço EVM para exibição pública (sem expor wallet completa). */
export function maskWalletAddress(wallet: string | null | undefined): string | null {
  if (!wallet) return null;
  const normalized = wallet.trim();
  if (normalized.length < 10) return null;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}
