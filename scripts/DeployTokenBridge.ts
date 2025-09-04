import { ethers } from "hardhat";

interface DeployParams {
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  weth: string;
  finality: number;
  evmChainId: number;
  wormhole: string;
}

interface DeployResult {
  deployedAddress: string;
  tokenImplementationAddress: string;
  bridgeSetupAddress: string;
  bridgeImplementationAddress: string;
}

async function deployTokenBridge(params: DeployParams): Promise<DeployResult> {
  console.log("Deploying Token Bridge contracts...");
  console.log("Parameters:", params);

  // Deploy TokenImplementation contract
  const TokenImplementation = await ethers.getContractFactory("TokenImplementation");
  const tokenImplementation = await TokenImplementation.deploy();
  await tokenImplementation.deployed();
  console.log("TokenImplementation deployed to:", tokenImplementation.address);

  // Deploy BridgeSetup contract
  const BridgeSetup = await ethers.getContractFactory("BridgeSetup");
  const bridgeSetup = await BridgeSetup.deploy();
  await bridgeSetup.deployed();
  console.log("BridgeSetup deployed to:", bridgeSetup.address);

  // Deploy BridgeImplementation contract
  const BridgeImplementation = await ethers.getContractFactory("BridgeImplementation");
  const bridgeImplementation = await BridgeImplementation.deploy();
  await bridgeImplementation.deployed();
  console.log("BridgeImplementation deployed to:", bridgeImplementation.address);

  // Prepare init data - matching Foundry script exactly:
  // "setup(address,uint16,address,uint16,bytes32,address,address,uint8,uint256)"
  const initData = bridgeSetup.interface.encodeFunctionData("setup", [
    bridgeImplementation.address,  // address implementation
    params.chainId,               // uint16 chainId
    params.wormhole,             // address wormhole
    params.governanceChainId,    // uint16 governanceChainId
    params.governanceContract,   // bytes32 governanceContract
    tokenImplementation.address, // address tokenImplementation
    params.weth,                // address weth
    params.finality,            // uint8 finality
    params.evmChainId          // uint256 evmChainId
  ]);

  // Deploy TokenBridge proxy with setup and init data
  const TokenBridge = await ethers.getContractFactory("TokenBridge");
  const tokenBridge = await TokenBridge.deploy(bridgeSetup.address, initData);
  await tokenBridge.deployed();
  console.log("TokenBridge deployed to:", tokenBridge.address);

  console.log("Token Bridge deployment completed successfully!");

  return {
    deployedAddress: tokenBridge.address,
    tokenImplementationAddress: tokenImplementation.address,
    bridgeSetupAddress: bridgeSetup.address,
    bridgeImplementationAddress: bridgeImplementation.address
  };
}

// Main function for direct script execution
async function main() {
  // Default parameters - adjust for your needs
  const defaultParams: DeployParams = {
    chainId: 1,
    governanceChainId: 1,
    governanceContract: "0x0000000000000000000000000000000000000000000000000000000000000004",
    weth: "0x0000000000000000000000000000000000000001", // Replace with real WETH address
    finality: 15,
    evmChainId: 420420420, // polkavm chain id
    wormhole: "0x0000000000000000000000000000000000000001" // Replace with deployed Wormhole address
  };

  const result = await deployTokenBridge(defaultParams);
  
  console.log("Final result:");
  console.log("- TokenBridge (proxy):", result.deployedAddress);
  console.log("- TokenImplementation:", result.tokenImplementationAddress);
  console.log("- BridgeSetup:", result.bridgeSetupAddress);
  console.log("- BridgeImplementation:", result.bridgeImplementationAddress);

  return result;
}

// Export for use in other scripts
export { deployTokenBridge, DeployParams, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}