import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployNFTBridgeShutdown(): Promise<DeployResult> {
  console.log("Deploying NFT Bridge Shutdown contract...");

  // Deploy NFTBridgeShutdown contract
  const NFTBridgeShutdown = await ethers.getContractFactory("NFTBridgeShutdown");
  const nftBridgeShutdown = await NFTBridgeShutdown.deploy();
  await nftBridgeShutdown.deployed();
  console.log("NFTBridgeShutdown deployed to:", nftBridgeShutdown.address);

  console.log("NFT Bridge Shutdown deployment completed successfully!");

  return {
    deployedAddress: nftBridgeShutdown.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployNFTBridgeShutdown();
  
  console.log("Final result:");
  console.log("- NFTBridgeShutdown:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployNFTBridgeShutdown, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}