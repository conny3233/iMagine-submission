// 배포 지갑 주소와 잔액을 확인한다.
//
//   npm run balance:sepolia

const { ethers, network } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("배포 계정이 없습니다. 루트 .env 의 DEPLOYER_PRIVATE_KEY 를 확인하세요 (node scripts/new-wallet.js).");
  }
  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(signer.address);
  const fee = await ethers.provider.getFeeData();

  console.log(`network : ${network.name} (chainId ${chainId})`);
  console.log(`address : ${signer.address}`);
  console.log(`balance : ${ethers.formatEther(balance)} ETH`);
  if (fee.gasPrice) {
    // 배포 ~60만 gas + 기록 1건 ~15만 gas 기준의 대략치
    const need = fee.gasPrice * 1_500_000n;
    console.log(`gas     : ${ethers.formatUnits(fee.gasPrice, "gwei")} gwei`);
    console.log(`목표    : 배포 1회 + 기록 5건 ≈ ${ethers.formatEther(need)} ETH`);
    console.log(balance >= need ? "✔ 충분합니다." : "✘ 부족합니다. faucet 에서 더 받으세요.");
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
