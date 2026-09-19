// 테스트넷 전용 배포 지갑을 만들어 루트 .env 에 넣는다. 개인키는 화면에 출력하지 않는다.
//
//   node scripts/new-wallet.js
//
// - .env 가 없으면 .env.example 을 복사해서 만든다.
// - DEPLOYER_PRIVATE_KEY 가 이미 있으면 덮어쓰지 않고 그 주소만 알려준다 (잔액이 든 지갑을 날리지 않게).
// - 실자산 지갑으로 절대 쓰지 말 것. .env 는 .gitignore 에 등록돼 있다.

const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });

const root = path.join(__dirname, "..", "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

function setEnvValue(text, key, value) {
  const line = new RegExp(`^${key}=.*$`, "m");
  if (line.test(text)) return text.replace(line, `${key}=${value}`);
  return text.replace(/\n?$/, `\n${key}=${value}\n`);
}

const existing = process.env.DEPLOYER_PRIVATE_KEY;
if (existing) {
  const address = new Wallet(existing).address;
  console.log("이미 지갑이 있습니다. 새로 만들지 않습니다.");
  console.log(`address : ${address}`);
  process.exit(0);
}

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log(".env 가 없어 .env.example 을 복사했습니다.");
}

const wallet = Wallet.createRandom();
let text = fs.readFileSync(envPath, "utf8");
text = setEnvValue(text, "DEPLOYER_PRIVATE_KEY", wallet.privateKey);
text = setEnvValue(text, "DEPLOYER_ADDRESS", wallet.address);
fs.writeFileSync(envPath, text);

console.log("✔ 테스트넷 전용 지갑을 만들어 .env 에 저장했습니다 (개인키는 출력하지 않음).");
console.log(`address : ${wallet.address}`);
console.log("\n다음: 이 주소로 Sepolia faucet 에서 테스트 ETH 를 받으세요 (docs/RUNBOOK.md 3-3).");
console.log("      받은 뒤 확인: npm run balance:sepolia");
