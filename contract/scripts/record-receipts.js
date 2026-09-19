// 영수증을 ConsentRegistry 에 기록한다. 서버가 아니라 이 스크립트로, 촬영 전에 한다.
//
//   npm run record:sepolia                                         # data/receipts/*.json 전부
//   RECEIPTS_DIR=../tmp/receipts npx hardhat run scripts/record-receipts.js --network localhost
//   ONLY=privacy DRY_RUN=1 npm run record:sepolia                  # 파일 이름 필터 · 전송 없이 점검만
//
// 영수증 파일 = { payload, recordHash, chainAttachment }
//   - payload 를 다시 해시해서 recordHash 와 같을 때만 기록한다 (틀리면 중단).
//   - 체인에 이미 같은 해시로 있으면 이벤트 로그에서 거래 정보를 찾아 chainAttachment 만 채운다 (재실행 안전).
//   - 체인에 다른 해시로 있으면 중단한다. 봉인된 영수증은 바뀌지 않는다.
//   - chainAttachment 는 해시 대상이 아니므로 기록 후에 채워도 recordHash 가 바뀌지 않는다.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { ethers, network } = require("hardhat");

const ROOT = path.join(__dirname, "..", "..");
const EXPLORERS = { sepolia: "https://sepolia.etherscan.io" };

function loadDeployment() {
  const p = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`배포 기록이 없습니다: ${path.relative(ROOT, p)} — 먼저 scripts/deploy.js 를 같은 --network 로 실행하세요.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function attachmentFromLogs(registry, receiptId, chainId, deployment) {
  const logs = await registry.queryFilter(
    registry.filters.ConsentRecorded(receiptId),
    deployment.deployBlock ?? 0,
  );
  if (logs.length === 0) return null;
  const log = logs[0];
  const block = await log.getBlock();
  const explorer = EXPLORERS[network.name] ?? null;
  return {
    network: network.name,
    chainId,
    contractAddress: deployment.address,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    recordedAt: new Date(block.timestamp * 1000).toISOString(),
    issuerAddress: log.args.issuer,
    explorerTxUrl: explorer ? `${explorer}/tx/${log.transactionHash}` : null,
  };
}

async function main() {
  const { recordHash: computeRecordHash, toBytes32 } = await import(
    pathToFileURL(path.join(ROOT, "scripts", "lib", "canonical.mjs")).href
  );

  const dir = path.resolve(ROOT, process.env.RECEIPTS_DIR || "data/receipts");
  const only = process.env.ONLY || "";
  const dryRun = process.env.DRY_RUN === "1";
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f.includes(only))
    .sort();
  if (files.length === 0) throw new Error(`기록할 영수증이 없습니다: ${dir}`);

  const deployment = loadDeployment();
  const { chainId: chainIdBig } = await ethers.provider.getNetwork();
  const chainId = Number(chainIdBig);
  if (deployment.chainId !== chainId) {
    throw new Error(`배포 기록의 chainId(${deployment.chainId})와 연결된 네트워크(${chainId})가 다릅니다.`);
  }
  const registry = await ethers.getContractAt("ConsentRegistry", deployment.address);
  const [signer] = await ethers.getSigners();

  console.log(`network  : ${network.name} (chainId ${chainId})`);
  console.log(`contract : ${deployment.address}`);
  console.log(`issuer   : ${signer.address}`);
  console.log(`receipts : ${files.length}건 (${path.relative(ROOT, dir)})${dryRun ? "  [DRY_RUN]" : ""}\n`);

  let failed = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    const receipt = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const { payload } = receipt;
    const label = `${file} (${payload.document.id}@${payload.document.version})`;

    const actual = computeRecordHash(payload);
    if (actual !== receipt.recordHash) {
      console.log(`✘ ${label}\n    recordHash 불일치 — 파일 ${receipt.recordHash} / 계산 ${actual}\n    node scripts/seal-receipts.mjs 로 다시 봉인하세요.`);
      failed++;
      continue;
    }
    if (receipt.chainAttachment && receipt.chainAttachment.chainId !== chainId) {
      console.log(`✘ ${label}\n    이미 다른 체인(${receipt.chainAttachment.chainId})에 기록된 파일입니다. 사본 폴더를 RECEIPTS_DIR 로 지정하세요.`);
      failed++;
      continue;
    }

    const receiptId = toBytes32(payload.receiptId);
    const documentRef = `${payload.document.id}@${payload.document.version}`;

    if (await registry.exists(receiptId)) {
      const onChain = await registry.get(receiptId);
      if (onChain.recordHash !== receipt.recordHash) {
        console.log(`✘ ${label}\n    체인에 다른 해시로 이미 봉인돼 있습니다 (${onChain.recordHash}). 이 receiptId 는 다시 쓸 수 없습니다.`);
        failed++;
        continue;
      }
      if (!receipt.chainAttachment) {
        receipt.chainAttachment = await attachmentFromLogs(registry, receiptId, chainId, deployment);
        if (!dryRun) fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");
        console.log(`• ${label}\n    이미 기록됨 — 거래 정보만 채웠습니다 (${receipt.chainAttachment?.txHash})`);
      } else {
        console.log(`• ${label}\n    이미 기록됨 — 건너뜀`);
      }
      continue;
    }

    if (dryRun) {
      console.log(`○ ${label}\n    기록 예정 — receiptId ${payload.receiptId} (${receiptId})`);
      continue;
    }

    const tx = await registry.record(receiptId, receipt.recordHash, payload.document.hash, documentRef);
    console.log(`… ${label}\n    전송 ${tx.hash} (채굴 대기 중)`);
    const mined = await tx.wait();
    if (mined.status !== 1) {
      console.log(`✘ 거래 실패 — ${tx.hash}`);
      failed++;
      continue;
    }
    receipt.chainAttachment = await attachmentFromLogs(registry, receiptId, chainId, deployment);
    fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2) + "\n");
    console.log(`✔ 블록 ${mined.blockNumber}${receipt.chainAttachment.explorerTxUrl ? `  ${receipt.chainAttachment.explorerTxUrl}` : ""}`);
  }

  if (failed > 0) {
    throw new Error(`\n${failed}건 실패`);
  }
  console.log("\n완료");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
