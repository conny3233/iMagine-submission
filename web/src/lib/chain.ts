// 블록체인 읽기 전용 조회. 지갑 없이 공개 RPC 로 조회만 한다.
// 서명은 화면이 하지 않는다 — 미리 기록한 영수증은 contract/scripts/record-receipts.js, 앱에서 방금 한 동의는
// 기록 서버(web/api/record.js)가 적고, 화면은 여기서 그 거래가 블록에 들어갔는지 읽기만 한다.

import { Contract, JsonRpcProvider, Network } from "ethers";

import registryAbi from "../../../contract/abi/ConsentRegistry.json";

export interface ChainInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string | null;
}

export const CHAINS: Record<number, ChainInfo> = {
  11155111: {
    chainId: 11155111,
    name: "Sepolia",
    rpcUrl:
      import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
  },
  31337: {
    chainId: 31337,
    name: "Hardhat 로컬",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: null,
  },
};

interface Deployment {
  contract: string;
  network: string;
  chainId: number;
  address: string;
}

const allowLocal = import.meta.env.VITE_ALLOW_LOCAL_CHAIN === "1";

// 배포 스크립트가 남긴 contract/deployments/*.json = 믿을 수 있는 계약 주소 목록.
// 영수증에 적힌 계약 주소가 여기 없으면 "모르는 계약"으로 표시한다 (주소를 위조한 영수증 대비).
const deployments = Object.values(
  import.meta.glob<Deployment>("../../../contract/deployments/*.json", {
    eager: true,
    import: "default",
  }),
).filter(
  (d) =>
    d.contract === "ConsentRegistry" &&
    d.network !== "hardhat" &&
    (d.chainId !== 31337 || allowLocal),
);

export function trustedRegistry(chainId: number, address: string): Deployment | null {
  return (
    deployments.find(
      (d) => d.chainId === chainId && d.address.toLowerCase() === address.toLowerCase(),
    ) ?? null
  );
}

/** section="logs" 면 Etherscan 의 Logs(이벤트) 탭으로 바로 연다 — 영수증 번호·지문이 보이는 곳. */
export function explorerTxUrl(chainId: number, txHash: string, section?: "logs"): string | null {
  const explorer = CHAINS[chainId]?.explorer;
  if (!explorer) return null;
  return `${explorer}/tx/${txHash}${section === "logs" ? "#eventlog" : ""}`;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const explorer = CHAINS[chainId]?.explorer;
  return explorer ? `${explorer}/address/${address}` : null;
}

/**
 * 사람이 읽는 receiptId 를 컨트랙트의 bytes32 로 바꾼다. scripts/lib/canonical.mjs 의
 * 동명 함수와 반드시 같은 규칙이어야 한다 — 다르면 기록 스크립트와 앱이 서로 다른 온체인
 * 슬롯을 가리키게 된다 (raw UTF-8 SHA-256, JSON 정규화 없음 — documentHash·recordHash 와는 다른 규칙).
 */
export async function toBytes32(hexOrStr: string): Promise<string> {
  if (hexOrStr.startsWith("0x") && hexOrStr.length === 66) return hexOrStr;
  const bytes = new TextEncoder().encode(hexOrStr);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return (
    "0x" +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface OnChainReceipt {
  recordHash: string;
  documentHash: string;
  documentRef: string;
  recordedAt: Date;
  issuer: string;
}

function registry(chainId: number, address: string): Contract {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`지원하지 않는 체인입니다 (chainId ${chainId})`);
  const network = Network.from(chainId);
  const provider = new JsonRpcProvider(chain.rpcUrl, network, { staticNetwork: network });
  return new Contract(address, registryAbi.abi, provider);
}

/**
 * 체인에 봉인된 영수증을 읽는다.
 * 기록이 없으면 null, 네트워크·RPC 오류면 throw — 둘을 섞으면 "미기록"과 "조회 실패"가 구분되지 않는다.
 */
export async function readReceipt(
  chainId: number,
  contractAddress: string,
  receiptIdRaw: string,
): Promise<OnChainReceipt | null> {
  const c = registry(chainId, contractAddress);
  const receiptId = await toBytes32(receiptIdRaw);
  if (!(await c.exists(receiptId))) return null;
  const r = await c.get(receiptId);
  return {
    recordHash: r.recordHash,
    documentHash: r.documentHash,
    documentRef: r.documentRef,
    recordedAt: new Date(Number(r.recordedAt) * 1000),
    issuer: r.issuer,
  };
}

/** 앱이 기록을 맡기는 장부 — 배포 목록의 Sepolia 계약. */
export function primaryRegistry(): Deployment | null {
  return deployments.find((d) => d.chainId === 11155111) ?? null;
}

/**
 * 기록 서버가 보낸 거래가 블록에 들어갔는지 공개 RPC 로 확인하고, 영수증에 붙일 거래 정보를 만든다.
 * 서버 응답을 그대로 믿지 않고 체인에서 ConsentRecorded 이벤트를 직접 찾는다.
 * txHash 가 없으면(이미 기록돼 있던 경우) 최근 블록에서 그 영수증 번호의 이벤트를 찾는다.
 */
export async function waitForRecorded(
  receiptIdRaw: string,
  txHash: string | null,
  timeoutMs = 180_000,
): Promise<ChainAttachmentLike> {
  const deployment = primaryRegistry();
  if (!deployment) throw new Error("기록할 장부 정보가 없습니다.");
  const c = registry(deployment.chainId, deployment.address);
  const provider = c.runner as JsonRpcProvider;
  const receiptId = await toBytes32(receiptIdRaw);

  let log: { transactionHash: string; blockNumber: number; issuer: string } | null = null;
  let reverted = false;
  if (txHash) {
    const mined = await provider.waitForTransaction(txHash, 1, timeoutMs);
    if (!mined) throw new Error("블록에 들어가기를 기다리다 시간이 다 됐습니다.");
    reverted = mined.status !== 1;
    for (const l of mined.logs) {
      if (l.address.toLowerCase() !== deployment.address.toLowerCase()) continue;
      const parsed = c.interface.parseLog(l);
      if (parsed?.name === "ConsentRecorded" && parsed.args.receiptId === receiptId) {
        log = { transactionHash: mined.hash, blockNumber: mined.blockNumber, issuer: parsed.args.issuer };
      }
    }
  }
  // 거래 번호를 모르거나, 그 거래가 거절됐으면(같은 영수증을 두 번 보내 먼저 간 쪽이 이미 적은 경우)
  // 영수증 번호로 최근 블록의 기록을 찾는다. 지문이 맞는지는 iMprint 대조가 따로 확인한다.
  if (!log) {
    const latest = await provider.getBlockNumber();
    const found = await c.queryFilter(c.filters.ConsentRecorded(receiptId), Math.max(0, latest - 5000), latest);
    const l = found[0] as (typeof found)[number] & { args?: { issuer: string } };
    if (l) log = { transactionHash: l.transactionHash, blockNumber: l.blockNumber, issuer: l.args?.issuer ?? "" };
  }
  if (!log) {
    throw new Error(reverted ? "블록체인이 기록을 거절했습니다." : "블록체인에서 이 영수증의 기록을 찾지 못했습니다.");
  }

  const block = await provider.getBlock(log.blockNumber);
  return {
    network: deployment.network,
    chainId: deployment.chainId,
    contractAddress: deployment.address,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    recordedAt: new Date((block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    issuerAddress: log.issuer,
    explorerTxUrl: explorerTxUrl(deployment.chainId, log.transactionHash),
  };
}

/** vault/types 의 ChainAttachment 와 같은 모양 (lib 이 vault 를 가져오지 않게 따로 적는다). */
export interface ChainAttachmentLike {
  network: string;
  chainId: number;
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  recordedAt: string;
  issuerAddress: string;
  explorerTxUrl: string | null;
}
