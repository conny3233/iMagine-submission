const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO32 = "0x" + "0".repeat(64);

function h(s) {
  return ethers.keccak256(ethers.toUtf8Bytes(s));
}

describe("ConsentRegistry", function () {
  let registry, bank, otherIssuer;

  beforeEach(async function () {
    [bank, otherIssuer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ConsentRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  const sample = () => ({
    receiptId: h("receipt-0001"),
    recordHash: h('{"decision":{"choice":"agree"}}'),
    documentHash: h("privacy-complaint v1 content"),
    documentRef: "privacy-complaint@v1",
  });

  async function recordSample(signer = bank) {
    const s = sample();
    const tx = await registry
      .connect(signer)
      .record(s.receiptId, s.recordHash, s.documentHash, s.documentRef);
    return { s, tx };
  }

  it("기록 후 조회 값이 일치하고, 시각은 블록 시각이다", async function () {
    const { s, tx } = await recordSample();
    const block = await ethers.provider.getBlock((await tx.wait()).blockNumber);

    expect(await registry.exists(s.receiptId)).to.equal(true);
    const r = await registry.get(s.receiptId);
    expect(r.recordHash).to.equal(s.recordHash);
    expect(r.documentHash).to.equal(s.documentHash);
    expect(r.documentRef).to.equal(s.documentRef);
    expect(r.recordedAt).to.equal(BigInt(block.timestamp));
    expect(r.issuer).to.equal(bank.address);
  });

  it("ConsentRecorded 이벤트를 emit 한다", async function () {
    const s = sample();
    await expect(registry.record(s.receiptId, s.recordHash, s.documentHash, s.documentRef))
      .to.emit(registry, "ConsentRecorded")
      .withArgs(s.receiptId, s.recordHash, s.documentHash, s.documentRef, bank.address);
  });

  it("같은 receiptId 는 다른 기관도 다시 기록할 수 없다 (봉인)", async function () {
    const { s } = await recordSample();

    await expect(
      registry
        .connect(otherIssuer)
        .record(s.receiptId, h("다른 영수증"), h("다른 문서"), "forged@v9"),
    ).to.be.revertedWithCustomError(registry, "AlreadyRecorded");

    const r = await registry.get(s.receiptId);
    expect(r.recordHash).to.equal(s.recordHash);
    expect(r.issuer).to.equal(bank.address);
  });

  it("기관이 달라도 각자 자기 영수증을 기록한다 (범용)", async function () {
    await recordSample(bank);
    await registry
      .connect(otherIssuer)
      .record(h("receipt-other"), h("other payload"), h("other doc"), "terms@v3");

    expect((await registry.get(h("receipt-other"))).issuer).to.equal(otherIssuer.address);
    expect((await registry.get(sample().receiptId)).issuer).to.equal(bank.address);
  });

  it("빈 해시는 거부한다", async function () {
    const s = sample();
    await expect(
      registry.record(s.receiptId, ZERO32, s.documentHash, s.documentRef),
    ).to.be.revertedWithCustomError(registry, "EmptyHash");
    await expect(
      registry.record(s.receiptId, s.recordHash, ZERO32, s.documentRef),
    ).to.be.revertedWithCustomError(registry, "EmptyHash");
  });

  it("없는 기록 조회는 NotFound revert", async function () {
    await expect(registry.get(h("없음"))).to.be.revertedWithCustomError(registry, "NotFound");
    expect(await registry.exists(h("없음"))).to.equal(false);
  });

  it("verify: 원본은 true, 변경본은 false, 미기록은 false", async function () {
    const { s } = await recordSample();
    expect(await registry.verify(s.receiptId, s.recordHash)).to.equal(true);
    expect(await registry.verify(s.receiptId, h("선택을 거부로 바꾼 사본"))).to.equal(false);
    expect(await registry.verify(h("없음"), ZERO32)).to.equal(false);
  });

  it("verifyDocument: 당시 문서(v1)는 true, 개정된 문서(v2)는 false", async function () {
    const { s } = await recordSample();
    expect(await registry.verifyDocument(s.receiptId, s.documentHash)).to.equal(true);
    expect(await registry.verifyDocument(s.receiptId, h("privacy-complaint v2 content"))).to.equal(false);
    expect(await registry.verifyDocument(h("없음"), ZERO32)).to.equal(false);
  });
});
