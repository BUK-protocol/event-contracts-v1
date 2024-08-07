import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { WALLET_PRIVATE_KEY, ALCHEMY_API_KEY } from "./constants";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    polygonMumbai: {
      // url: "https://rpc-mumbai.maticvigil.com",
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts:
        process.env.WALLET_PRIVATE_KEY !== undefined
          ? [WALLET_PRIVATE_KEY]
          : [],
    },
    plum_test: {
      url: `https://plume-testnet.rpc.caldera.xyz/http`,
      accounts:
        process.env.WALLET_PRIVATE_KEY !== undefined
          ? [process.env.WALLET_PRIVATE_KEY]
          : [],
    },
    polygon_mainnet: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts:
        process.env.WALLET_PRIVATE_KEY !== undefined
          ? [process.env.WALLET_PRIVATE_KEY]
          : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      plum_test: "test",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      polygon_mainnet: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "plum_test",
        chainId: 161221135,
        urls: {
          apiURL: "https://plume-testnet.explorer.caldera.xyz/api?",
          browserURL: "https://plume-testnet.explorer.caldera.xyz",
        },
      },
    ],
  },
};

export default config;
