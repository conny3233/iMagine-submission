// 배포한 ConsentRegistry 의 소스를 공개한다 (Sourcify 는 키 없이, Etherscan 은 ETHERSCAN_API_KEY 가 있을 때).
//
//   npm run verify:sepolia
//
// 주소는 contract/deployments/<network>.json 에서 읽는다.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const networkName = process.argv[2] || "sepolia";
const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);
if (!fs.existsSync(deploymentPath)) {
  console.error(`배포 기록이 없습니다: deployments/${networkName}.json — 먼저 npm run deploy:${networkName}`);
  process.exit(1);
}
const { address } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
console.log(`verify ${address} on ${networkName}\n`);

const result = spawnSync("npx", ["hardhat", "verify", "--network", networkName, address], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
