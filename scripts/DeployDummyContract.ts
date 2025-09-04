import { ethers } from "hardhat";

interface DeployParams {
  num: number;
}

interface DeployResult {
  deployedAddresses: string[];
}

async function deployDummyContract(params: DeployParams): Promise<DeployResult> {
  console.log(`Deploying ${params.num} dummy Setup contracts...`);

  const deployedAddresses: string[] = [];

  // Deploy Setup contracts in a loop
  const Setup = await ethers.getContractFactory("Setup");
  
  for (let i = 0; i < params.num; i++) {
    const setup = await Setup.deploy();
    await setup.deployed();
    deployedAddresses.push(setup.address);
    console.log(`Setup ${i + 1} deployed to:`, setup.address);
  }

  console.log("Dummy contract deployment completed successfully!");

  return {
    deployedAddresses
  };
}

// Main function for direct script execution
async function main() {
  // Default to deploy 1 dummy contract
  const defaultParams: DeployParams = {
    num: 1
  };

  const result = await deployDummyContract(defaultParams);
  
  console.log("Final result:");
  console.log("- Deployed Addresses:", result.deployedAddresses);

  return result;
}

// Export for use in other scripts
export { deployDummyContract, DeployParams, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}