import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './config';

export function Web3Provider({ children }: { children: ReactNode }) {
  // Do not auto-reconnect injected wallets on mount (opens Phantom/Ronin/etc.).
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      {children}
    </WagmiProvider>
  );
}
