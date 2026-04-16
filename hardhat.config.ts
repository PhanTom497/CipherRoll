import "@cofhe/hardhat-plugin";
import "@nomicfoundation/hardhat-toolbox";
import { config as loadEnv } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

loadEnv();

const accounts = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun",
      viaIR: true
    }
  },
  networks: {
    hardhat: {},
    "arb-sepolia": {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts,
      chainId: 421614,
      gasMultiplier: 1.2,
      timeout: 90000
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts,
      chainId: 84532,
      gasMultiplier: 1.2,
      timeout: 90000
    }
  },
  cofhe: {
    logMocks: false,
    gasWarning: false,
    mocksDeployVerbosity: "v"
  },
  mocha: {
    timeout: 120000
  }
};

export default config;
