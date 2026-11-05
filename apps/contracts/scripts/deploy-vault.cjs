/**
 * Deploy only USDCPlayerVault on Polygon (or Amoy).
 * Usage: USDC_ADDRESS=0x3c499... npx hardhat run scripts/deploy-vault.cjs --network polygon
 */
const hre = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');

const POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const MIN_USDC = 1_000_000n; // 1 USDC (6 decimals)

async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const [deployer] = await hre.viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  const usdcAddress = process.env.USDC_ADDRESS || POLYGON_USDC;

  console.log('Deployer:', deployer.account.address);
  console.log('Chain:', chainId);
  console.log('USDC token:', usdcAddress);

  const vault = await hre.viem.deployContract('USDCPlayerVault', [
    usdcAddress,
    MIN_USDC,
    MIN_USDC,
  ]);

  const manifest = {
    network: hre.network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      USDC: usdcAddress,
      USDCPlayerVault: vault.address,
    },
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  console.log('\n✅ USDCPlayerVault deployed:', vault.address);
  console.log('\nUpdate .env:');
  console.log(`CONTRACT_USDC_VAULT=${vault.address}`);
  console.log(`VITE_CONTRACT_USDC_VAULT=${vault.address}`);
  console.log(`\nManifest: ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
