/// <reference types="vite/client" />

declare namespace React {
  interface HTMLAttributes<T> {
    inert?: '' | undefined;
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_WC_PROJECT_ID: string;
  readonly VITE_CONTRACT_PLAYER_NFT: string;
  readonly VITE_CONTRACT_SCOUT: string;
  readonly VITE_CONTRACT_MARKETPLACE: string;
  readonly VITE_CONTRACT_STAKING: string;
  readonly VITE_USDC: string;
  readonly VITE_CONTRACT_USDC_VAULT: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_DISCORD_URL: string;
  readonly VITE_TELEGRAM_URL: string;
  readonly VITE_GENESIS_DAO_URL: string;
  readonly VITE_OFFERWALL_ZERADS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
