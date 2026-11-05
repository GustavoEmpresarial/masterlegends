import type { WalletChallengeDTO, WalletLinkResponseDTO } from '@mll/shared';
import { ensureWalletOnTargetChain } from '../web3/ensureChain';
import { reportFailure } from '../telemetry/reportFailure';
import type { EthereumProvider } from './ethereum';
import { formatWalletAddress } from './format';

export { formatWalletAddress };

function walletError(code: string): Error {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

/**
 * Normalizes a raw wagmi/viem connector error (numeric `.code`, sometimes nested
 * under `.cause`) into our own WALLET_* error, so the UI shows the localized
 * message instead of falling back to the generic "algo deu errado" — viem errors
 * don't match extractErrorCode's string-`.code`/`WALLET_`-prefixed-message checks.
 */
export function normalizeWalletConnectError(err: unknown): Error {
  const existingCode = (err as { code?: unknown })?.code;
  if (typeof existingCode === 'string') return err as Error;

  const nested = (err as { cause?: { code?: unknown } })?.cause?.code;
  const numericCode = typeof existingCode === 'number' ? existingCode : nested;

  if (numericCode === 4001) return walletError('WALLET_USER_REJECTED');
  if (numericCode === -32002) return walletError('WALLET_REQUEST_PENDING');
  return walletError('WALLET_CONNECT_FAILED');
}

type ProviderWithMeta = EthereumProvider & { isMetaMask?: boolean; providers?: ProviderWithMeta[] };

/** Prefer MetaMask when multiple injected wallets are present. */
export function getMetaMaskProvider(): ProviderWithMeta | null {
  if (typeof window === 'undefined') return null;
  const eth = window.ethereum as ProviderWithMeta | undefined;
  if (!eth) return null;
  if (eth.providers?.length) {
    const mm = eth.providers.find((p) => p.isMetaMask);
    if (mm) return mm;
  }
  if (eth.isMetaMask) return eth;
  return eth;
}

function getProvider(): ProviderWithMeta {
  const provider = getMetaMaskProvider();
  if (!provider) {
    throw walletError('WALLET_NOT_INSTALLED');
  }
  return provider;
}

export function isWalletInstalled(): boolean {
  return getMetaMaskProvider() !== null;
}

async function readAccounts(provider: ProviderWithMeta): Promise<string[]> {
  return (await provider.request({ method: 'eth_accounts' })) as string[];
}

/** Connect wallet, switch chain, return active account address. */
export async function connectWalletAndGetAddress(): Promise<string> {
  const provider = getProvider();

  let accounts = await readAccounts(provider).catch(() => [] as string[]);
  if (!accounts[0]) {
    try {
      accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const reason =
        code === 4001 ? 'user_rejected' : code === -32002 ? 'request_pending' : 'request_failed';
      reportFailure({ kind: 'wallet_connect', reason, context: { code: code ?? null } });
      if (code === 4001) throw walletError('WALLET_USER_REJECTED');
      if (code === -32002) throw walletError('WALLET_REQUEST_PENDING');
      throw walletError('WALLET_CONNECT_FAILED');
    }
  }

  try {
    await ensureWalletOnTargetChain();
  } catch (err) {
    const code = (err as { code?: number })?.code;
    const reason = code === 4001 ? 'user_rejected' : 'switch_failed';
    reportFailure({ kind: 'wallet_chain_switch', reason, context: { code: code ?? null } });
    if (code === 4001) throw walletError('WALLET_CHAIN_REJECTED');
    throw walletError('WALLET_CHAIN_SWITCH_FAILED');
  }

  // Re-read after chain switch — active account may differ.
  accounts = await readAccounts(provider).catch(() => accounts);
  const address = accounts[0];
  if (!address) {
    throw walletError('WALLET_NO_ACCOUNT');
  }

  return address;
}

export async function signWalletMessage(address: string, message: string): Promise<string> {
  const provider = getProvider();
  try {
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
    return signature;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4001) throw walletError('WALLET_USER_REJECTED');
    if (code === -32002) throw walletError('WALLET_REQUEST_PENDING');
    throw walletError('WALLET_CONNECT_FAILED');
  }
}

export async function fetchWalletChallenge(
  getChallenge: () => Promise<WalletChallengeDTO>,
): Promise<WalletChallengeDTO> {
  return getChallenge();
}

export type { WalletChallengeDTO, WalletLinkResponseDTO };
