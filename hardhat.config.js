require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config(); // Make sure dotenv is installed (npm install dotenv) if you use it

// ADD YOUR ADMIN_PRIVATE_KEY HERE
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || "b471b27ff333a78f8c0fda2490c5cdc942a42ae0ce7b3a9e8d3f4822a7c05aa7"; // Use environment variable or paste directly

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24", // Match your contract's pragma
  networks: {
    hardhat: {
      // Config for local testing
    },
    amoy: {
      url: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/", // Use environment variable or paste directly
      accounts: [`0x${ADMIN_PRIVATE_KEY}`], // Hardhat expects the 0x prefix
      // --- ADDED THIS SECTION ---
      gasPrice: "auto", // Let Hardhat estimate, but set overrides below
      // Explicitly set gas price parameters higher than the minimum requirement
      // Values are in WEI (1 Gwei = 1,000,000,000 Wei)
      // We set slightly above the required 25 Gwei tip
      maxPriorityFeePerGas: 30000000000, // 30 Gwei tip
      maxFeePerGas: 100000000000,         // 100 Gwei max total fee (includes base fee + tip)
      // --- END ADDED SECTION ---
    }
  },
  etherscan: {
    // Optional: Add API key for contract verification on Polygonscan
    // apiKey: process.env.POLYGONSCAN_API_KEY
  },
  // If using Solidity >= 0.8.18, add this setting for compilation target
  // See: https://hardhat.org/hardhat-runner/docs/config#solidity-compiler-configuration
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris" // or "shanghai" depending on your needs, "paris" is common
    }
  }
};