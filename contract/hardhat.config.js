require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config({ path: "../.env", quiet: true });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // 로컬 인메모리 네트워크 (npx hardhat test 가 자동 사용)
    hardhat: {},
    // Sepolia 테스트넷 — 체인ID 11155111 / 통화 SepoliaETH. 공개 RPC 는 CORS 허용이라 브라우저도 같은 주소를 쓴다.
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  // 소스 공개. Etherscan 은 API 키가 있어야 하고, Sourcify 는 키 없이 된다.
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  sourcify: {
    enabled: true,
  },
};
