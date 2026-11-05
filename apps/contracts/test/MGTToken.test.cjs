const { expect } = require('chai');
const hre = require('hardhat');
const { parseEther } = require('viem');

describe('MGTToken', function () {
  it('mints initial supply to treasury', async function () {
    const [deployer] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract('MGTToken', [deployer.account.address]);
    const balance = await token.read.balanceOf([deployer.account.address]);
    expect(balance).to.equal(parseEther('80000000'));
  });

  it('exposes correct name and symbol', async function () {
    const [deployer] = await hre.viem.getWalletClients();
    const token = await hre.viem.deployContract('MGTToken', [deployer.account.address]);
    expect(await token.read.name()).to.equal('Master Goal Token');
    expect(await token.read.symbol()).to.equal('MGT');
  });
});
