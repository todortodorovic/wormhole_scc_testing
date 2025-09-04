import { ethers } from "hardhat";

interface DeployResult {
  deployedAddress: string;
}

async function deployCoreImplementationOnly(): Promise<DeployResult> {
  console.log("Deploying Core Implementation contract only...");

  // Deploy Implementation contract
  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = await Implementation.deploy();
  await implementation.deployed();
  console.log("Implementation deployed to:", implementation.address);

  console.log("Core Implementation deployment completed successfully!");

  return {
    deployedAddress: implementation.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployCoreImplementationOnly();
  
  console.log("Final result:");
  console.log("- Implementation:", result.deployedAddress);

  return result;
}

// Export for use in other scripts
export { deployCoreImplementationOnly, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}