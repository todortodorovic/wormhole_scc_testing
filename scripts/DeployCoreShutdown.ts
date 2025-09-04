import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployCoreShutdown(): Promise<DeployResult> {
  console.log("Deploying Core Shutdown contract...");

  // Deploy Shutdown contract
  const Shutdown = await ethers.getContractFactory("Shutdown");
  const shutdown = await Shutdown.deploy();
  await shutdown.deployed();
  console.log("Shutdown deployed to:", shutdown.address);

  console.log("Core Shutdown deployment completed successfully!");

  return {
    deployedAddress: shutdown.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployCoreShutdown();
  
  console.log("Final result:");
  console.log("- Shutdown:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployCoreShutdown, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}