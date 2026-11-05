import { ethers } from 'ethers';
import { config } from '../../config/env.js';

const VAULT_ABI = [
  'function operatorLockWithdraw(address user, uint256 amount)',
  'function fulfillWithdraw(address user, uint256 amount)',
  'function releaseWithdraw(address user, uint256 amount)',
  'function pendingWithdraw(address user) view returns (uint256)',
  'function balanceOf(address user) view returns (uint256)',
  'function setLimits(uint256 minDeposit, uint256 minWithdraw)',
];

export class VaultOperatorService {
  private getProvider() {
    const rpc =
      config.CHAIN_ID === 137 ? config.POLYGON_RPC_URL : config.AMOY_RPC_URL;
    if (!rpc) throw new Error('RPC URL not configured');
    return new ethers.JsonRpcProvider(rpc);
  }

  private getOperatorSigner() {
    const key = config.OPERATOR_PRIVATE_KEY;
    if (!key) throw new Error('OPERATOR_PRIVATE_KEY not configured');
    return new ethers.Wallet(key, this.getProvider());
  }

  private getVaultContract(signer?: ethers.Signer) {
    const vaultAddress = config.CONTRACT_USDC_VAULT;
    if (!vaultAddress) throw new Error('CONTRACT_USDC_VAULT not configured');
    return new ethers.Contract(
      vaultAddress,
      VAULT_ABI,
      signer ?? this.getProvider(),
    );
  }

  async readVaultBalance(wallet: string): Promise<number> {
    try {
      const vault = this.getVaultContract();
      const raw = await vault.balanceOf(wallet);
      return Number(raw) / 1_000_000;
    } catch {
      return 0;
    }
  }

  async readPendingOnChain(wallet: string): Promise<number> {
    try {
      const vault = this.getVaultContract();
      const raw = await vault.pendingWithdraw(wallet);
      return Number(raw) / 1_000_000;
    } catch {
      return 0;
    }
  }

  async approveAndFulfill(wallet: string, amountUsdc: number): Promise<string> {
    const signer = this.getOperatorSigner();
    const vault = this.getVaultContract(signer);
    const amount = BigInt(Math.round(amountUsdc * 1_000_000));
    const lockTx = await vault.operatorLockWithdraw(wallet, amount);
    await lockTx.wait();
    const tx = await vault.fulfillWithdraw(wallet, amount);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  }

  async releasePending(wallet: string, amountUsdc: number): Promise<string | null> {
    try {
      const signer = this.getOperatorSigner();
      const vault = this.getVaultContract(signer);
      const amount = BigInt(Math.round(amountUsdc * 1_000_000));
      const tx = await vault.releaseWithdraw(wallet, amount);
      const receipt = await tx.wait();
      return receipt?.hash ?? tx.hash;
    } catch {
      return null;
    }
  }
}
