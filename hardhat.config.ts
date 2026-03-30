import "@nomicfoundation/hardhat-toolbox";
import "cofhe-hardhat-plugin";
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
    "eth-sepolia": {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts,
      chainId: 11155111,
      gasMultiplier: 1.2,
      timeout: 90000
    }
  },
  mocha: {
    timeout: 120000
  }
};

export default config;
