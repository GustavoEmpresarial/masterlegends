const { expect } = require('chai');
const hre = require('hardhat');
const { parseUnits } = require('viem');

const ONE_USDC = parseUnits('1', 6);

describe('USDCPlayerVault', function () {
  async function deployFixture() {
    const [deployer, player] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const usdc = await hre.viem.deployContract('MockUSDC', []);
    const vault = await hre.viem.deployContract('USDCPlayerVault', [
      usdc.address,
      ONE_USDC,
      ONE_USDC,
    ]);

    await usdc.write.mint([player.account.address, parseUnits('100', 6)]);

    return { deployer, player, publicClient, usdc, vault };
  }

  it('deposits USDC and updates balance', async function () {
    const { player, usdc, vault } = await deployFixture();
    const amount = parseUnits('10', 6);

    await usdc.write.approve([vault.address, amount], { account: player.account });
    await vault.write.deposit([amount], { account: player.account });

    expect(await vault.read.balanceOf([player.account.address])).to.equal(amount);
  });

  it('fulfills operator-approved withdrawal', async function () {
    const { deployer, player, usdc, vault } = await deployFixture();
    const amount = parseUnits('10', 6);

    await usdc.write.approve([vault.address, amount], { account: player.account });
    await vault.write.deposit([amount], { account: player.account });
    await vault.write.operatorLockWithdraw([player.account.address, amount], {
      account: deployer.account,
    });
    await vault.write.fulfillWithdraw([player.account.address, amount], {
      account: deployer.account,
    });

    expect(await vault.read.balanceOf([player.account.address])).to.equal(0n);
    expect(await vault.read.pendingWithdraw([player.account.address])).to.equal(0n);
    expect(await usdc.read.balanceOf([player.account.address])).to.equal(parseUnits('100', 6));
  });

  it('releaseWithdraw returns pending to balance', async function () {
    const { deployer, player, usdc, vault } = await deployFixture();
    const amount = parseUnits('5', 6);

    await usdc.write.approve([vault.address, amount], { account: player.account });
    await vault.write.deposit([amount], { account: player.account });
    await vault.write.operatorLockWithdraw([player.account.address, amount], {
      account: deployer.account,
    });
    await vault.write.releaseWithdraw([player.account.address, amount], {
      account: deployer.account,
    });

    expect(await vault.read.balanceOf([player.account.address])).to.equal(amount);
    expect(await vault.read.pendingWithdraw([player.account.address])).to.equal(0n);
  });

  it('reverts operator lock when balance is insufficient', async function () {
    const { deployer, player, vault } = await deployFixture();

    await expect(
      vault.write.operatorLockWithdraw([player.account.address, ONE_USDC], {
        account: deployer.account,
      }),
    ).to.be.rejected;
  });

  it('reverts deposit below minimum', async function () {
    const { player, usdc, vault } = await deployFixture();
    const amount = parseUnits('0.5', 6);

    await usdc.write.approve([vault.address, amount], { account: player.account });
    await expect(
      vault.write.deposit([amount], { account: player.account }),
    ).to.be.rejected;
  });

  it('blocks deposit when paused', async function () {
    const { deployer, player, usdc, vault } = await deployFixture();
    const amount = parseUnits('5', 6);

    await vault.write.pause([], { account: deployer.account });
    await usdc.write.approve([vault.address, amount], { account: player.account });

    await expect(
      vault.write.deposit([amount], { account: player.account }),
    ).to.be.rejected;
  });
});
