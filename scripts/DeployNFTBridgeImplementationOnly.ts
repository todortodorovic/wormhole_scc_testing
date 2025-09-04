import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployNFTBridgeImplementationOnly(): Promise<DeployResult> {
  console.log("Deploying NFT Bridge Implementation contract only...");

  // Deploy NFTBridgeImplementation contract
  const NFTBridgeImplementation = await ethers.getContractFactory("NFTBridgeImplementation");
  const nftBridgeImplementation = await NFTBridgeImplementation.deploy();
  await nftBridgeImplementation.deployed();
  console.log("NFTBridgeImplementation deployed to:", nftBridgeImplementation.address);

  console.log("NFT Bridge Implementation deployment completed successfully!");

  return {
    deployedAddress: nftBridgeImplementation.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployNFTBridgeImplementationOnly();
  
  console.log("Final result:");
  console.log("- NFTBridgeImplementation:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployNFTBridgeImplementationOnly, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}