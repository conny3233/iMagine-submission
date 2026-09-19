// 컴파일 결과에서 ABI 만 뽑아 contract/abi/ConsentRegistry.json 에 둔다.
// 웹(web/src/lib/chain.ts)이 이 파일을 직접 import 하므로 ABI 사본은 한 벌뿐이다.
//
//   npm run abi     (= hardhat compile && node scripts/export-abi.js)

const fs = require("fs");
const path = require("path");

const artifact = path.join(
  __dirname, "..", "artifacts", "contracts", "ConsentRegistry.sol", "ConsentRegistry.json",
);
if (!fs.existsSync(artifact)) {
  console.error("컴파일 결과가 없습니다. 먼저 npx hardhat compile");
  process.exit(1);
}
const { contractName, abi } = JSON.parse(fs.readFileSync(artifact, "utf8"));
const out = path.join(__dirname, "..", "abi", "ConsentRegistry.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ contractName, abi }, null, 2) + "\n");
console.log(`saved ${path.relative(process.cwd(), out)} (${abi.length} entries)`);
