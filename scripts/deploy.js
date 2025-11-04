const hre = require("hardhat");

async function main() {
  // Get the contract factory for "Voting".
  const Voting = await hre.ethers.getContractFactory("Voting");

  // Get the wallet that is doing the deploying.
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  // We pass the deployer's address to the constructor
  const votingContract = await Voting.deploy(deployer.address);

  // --- THIS IS THE FIX (Ethers v6) ---
  // We wait for the deployment to be fully confirmed.
  // .deployed() is replaced with .waitForDeployment()
  await votingContract.waitForDeployment();

  // Print the final, public address of our "vault"
  // In Ethers v6, the address is on the '.target' property
  console.log("Contract deployed to address:", votingContract.target);
  // --- END OF FIX ---
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1.
});

