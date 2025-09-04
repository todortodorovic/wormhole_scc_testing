import { ethers } from "hardhat";

interface DeployParams {
  initialSigners: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  evmChainId: number;
}

interface DeployResult {
  deployedAddress: string;
  setupAddress: string;
  implAddress: string;
}

async function deployCore(params: DeployParams): Promise<DeployResult> {
  console.log("Deploying Core Wormhole contracts...");
  console.log("Parameters:", params);

  // Deploy Implementation contract
  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = await Implementation.deploy();
  await implementation.deployed();
  console.log("Implementation deployed to:", implementation.address);

  // Deploy Setup contract
  const Setup = await ethers.getContractFactory("Setup");
  const setup = await Setup.deploy();
  await setup.deployed();
  console.log("Setup deployed to:", setup.address);

  // Prepare init data - matching Foundry script exactly:
  // abi.encodeWithSignature("setup(address,address[],uint16,uint16,bytes32,uint256)", ...)
  const initData = setup.interface.encodeFunctionData("setup", [
    implementation.address,
    params.initialSigners,
    params.chainId,
    params.governanceChainId,
    params.governanceContract,
    params.evmChainId
  ]);

  // Deploy Wormhole proxy with setup and init data
  const Wormhole = await ethers.getContractFactory("Wormhole");
  const wormhole = await Wormhole.deploy(setup.address, initData);
  await wormhole.deployed();
  console.log("Wormhole deployed to:", wormhole.address);

  console.log("Core deployment completed successfully!");

  return {
    deployedAddress: wormhole.address,
    setupAddress: setup.address,
    implAddress: implementation.address
  };
}

// Main function for direct script execution
async function main() {
  // Default parameters - use 420420420 for polkavm evmChainId
  const defaultParams: DeployParams = {
    initialSigners: ["0x0000000000000000000000000000000000000001"],
    chainId: 1,
    governanceChainId: 1,
    governanceContract: "0x0000000000000000000000000000000000000000000000000000000000000004",
    evmChainId: 420420420  // polkavm chain id
  };

  // You can override parameters with command line args or env vars
  const result = await deployCore(defaultParams);
  
  console.log("Final result:");
  console.log("- Wormhole (proxy):", result.deployedAddress);
  console.log("- Setup:", result.setupAddress);  
  console.log("- Implementation:", result.implAddress);

  return result;
}

// Export for use in other scripts
export { deployCore, DeployParams, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}