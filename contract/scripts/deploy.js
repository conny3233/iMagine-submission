// ConsentRegistry 배포. 로컬(hardhat·localhost)·Sepolia 공통.
//
//   npx hardhat run scripts/deploy.js                        # 로컬 (인메모리, 휘발)
//   npx hardhat run scripts/deploy.js --network localhost    # 로컬 노드 (npx hardhat node)
//   npm run deploy:sepolia                                   # Sepolia (.env 의 DEPLOYER_PRIVATE_KEY + SepoliaETH 필요)
//
// 배포 결과를 contract/deployments/<network>.json 에 저장한다.
// 앱은 이 파일을 "믿을 수 있는 계약 주소 목록"으로 읽으므로 주소를 따로 복사할 필요가 없다.

const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const EXPLORERS = {
  sepolia: "https://sepolia.etherscan.io",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      `배포 계정이 없습니다. --network ${network.name} 이면 루트 .env 의 DEPLOYER_PRIVATE_KEY 를 확인하세요.\n` +
        `지갑이 없으면: node scripts/new-wallet.js`,
    );
  }

  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network   : ${network.name} (chainId ${chainId})`);
  console.log(`deployer  : ${deployer.address}`);
  console.log(`balance   : ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) {
    throw new Error("잔액이 0 입니다. faucet 에서 테스트 ETH 를 받은 뒤 다시 실행하세요 (docs/RUNBOOK.md 3-3).");
  }

  const Factory = await ethers.getContractFactory("ConsentRegistry");
  const registry = await Factory.deploy();
  const deployTx = registry.deploymentTransaction();
  console.log(`\ntx hash   : ${deployTx.hash}  (채굴 대기 중…)`);
  const receipt = await deployTx.wait();

  const address = await registry.getAddress();
  const explorer = EXPLORERS[network.name];
  console.log(`\n✔ ConsentRegistry deployed`);
  console.log(`address   : ${address}`);
  console.log(`block     : ${receipt.blockNumber}`);
  if (explorer) console.log(`explorer  : ${explorer}/address/${address}`);

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        contract: "ConsentRegistry",
        network: network.name,
        chainId: Number(chainId),
        address,
        deployTxHash: deployTx.hash,
        deployBlock: receipt.blockNumber,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        explorer: explorer ?? null,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nsaved     : ${path.relative(process.cwd(), outPath)}`);
  if (explorer) {
    console.log(`\n다음: npm run verify:sepolia   (소스 공개)`);
    console.log(`      npm run record:sepolia   (data/receipts 의 영수증 기록)`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
