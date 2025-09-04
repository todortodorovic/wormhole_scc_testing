import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployTokenBridgeImplementationOnly(): Promise<DeployResult> {
  console.log("Deploying Token Bridge Implementation contract only...");

  // Deploy BridgeImplementation contract
  const BridgeImplementation = await ethers.getContractFactory("BridgeImplementation");
  const bridgeImplementation = await BridgeImplementation.deploy();
  await bridgeImplementation.deployed();
  console.log("BridgeImplementation deployed to:", bridgeImplementation.address);

  console.log("Token Bridge Implementation deployment completed successfully!");

  return {
    deployedAddress: bridgeImplementation.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployTokenBridgeImplementationOnly();
  
  console.log("Final result:");
  console.log("- BridgeImplementation:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployTokenBridgeImplementationOnly, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}