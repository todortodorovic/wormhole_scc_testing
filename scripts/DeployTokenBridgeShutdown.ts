import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployTokenBridgeShutdown(): Promise<DeployResult> {
  console.log("Deploying Token Bridge Shutdown contract...");

  // Deploy BridgeShutdown contract
  const BridgeShutdown = await ethers.getContractFactory("BridgeShutdown");
  const bridgeShutdown = await BridgeShutdown.deploy();
  await bridgeShutdown.deployed();
  console.log("BridgeShutdown deployed to:", bridgeShutdown.address);

  console.log("Token Bridge Shutdown deployment completed successfully!");

  return {
    deployedAddress: bridgeShutdown.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployTokenBridgeShutdown();
  
  console.log("Final result:");
  console.log("- BridgeShutdown:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployTokenBridgeShutdown, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}