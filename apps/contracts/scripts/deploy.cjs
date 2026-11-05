const hre = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');

// Phase-1 core contracts (ADR-0012). ScoutEngine, StakingVault, RewardsPool are
// experimental — deploy separately when on-chain scout/staking ships.
async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const [deployer] = await hre.viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  const treasury = deployer.account.address;
  let usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    const mockUsdc = await hre.viem.deployContract('MockUSDC', []);
    usdcAddress = mockUsdc.address;
    console.log('Deployed MockUSDC for local/testing:', usdcAddress);
  }
  const rewardsPool = process.env.REWARDS_POOL_ADDRESS ?? treasury;

  const usdcVault = await hre.viem.deployContract('USDCPlayerVault', [
    usdcAddress,
    1_000_000n, // 1 USDC min deposit
    1_000_000n, // 1 USDC min withdraw
  ]);

  const mgt = await hre.viem.deployContract('MGTToken', [treasury]);
  const playerNft = await hre.viem.deployContract('MLLPlayerNFT', []);
  const burnEngine = await hre.viem.deployContract('BurnEngine', [playerNft.address]);
  const marketplace = await hre.viem.deployContract('Marketplace', [
    playerNft.address,
    usdcAddress,
    rewardsPool,
  ]);

  const manifest = {
    network: hre.network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      MGTToken: mgt.address,
      MLLPlayerNFT: playerNft.address,
      BurnEngine: burnEngine.address,
      Marketplace: marketplace.address,
      USDC: usdcAddress,
      USDCPlayerVault: usdcVault.address,
      RewardsPool: rewardsPool,
    },
    experimental: ['ScoutEngine', 'StakingVault', 'RewardsPool'],
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  console.log(`Deployment manifest written to ${outFile}`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
