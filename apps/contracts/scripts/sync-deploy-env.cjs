/**
 * Reads deployments/{network}.json and prints CONTRACT_* env vars.
 *
 * Usage:
 *   node scripts/sync-deploy-env.cjs hardhat
 *   node scripts/sync-deploy-env.cjs amoy >> ../../.env
 */
const fs = require('node:fs');
const path = require('node:path');

const network = process.argv[2] ?? 'hardhat';
const manifestPath = path.join(__dirname, '..', 'deployments', `${network}.json`);

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  console.error('Run: npx hardhat run scripts/deploy.cjs --network', network);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const c = manifest.contracts ?? {};

const mapping = {
  CONTRACT_MGT: c.MGTToken,
  CONTRACT_PLAYER_NFT: c.MLLPlayerNFT,
  CONTRACT_BURN: c.BurnEngine,
  CONTRACT_MARKETPLACE: c.Marketplace,
  CONTRACT_SCOUT: c.ScoutEngine,
  CONTRACT_STAKING: c.StakingVault,
  CONTRACT_REWARDS_POOL: c.RewardsPool,
  CONTRACT_USDC_VAULT: c.USDCPlayerVault,
  USDC_ADDRESS: c.USDC,
  CHAIN_ID: manifest.chainId,
};

const viteMapping = {
  VITE_CONTRACT_USDC_VAULT: c.USDCPlayerVault,
  VITE_USDC: c.USDC,
  VITE_CHAIN_ID: manifest.chainId,
};

console.log(`# Synced from deployments/${network}.json (${manifest.deployedAt})`);
for (const [key, value] of Object.entries(mapping)) {
  if (value !== undefined && value !== null && value !== '') {
    console.log(`${key}=${value}`);
  }
}
for (const [key, value] of Object.entries(viteMapping)) {
  if (value !== undefined && value !== null && value !== '') {
    console.log(`${key}=${value}`);
  }
}
