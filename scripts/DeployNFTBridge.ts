import { ethers } from "hardhat";

interface DeployParams {
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  finality: number;
  evmChainId: number;
  wormhole: string;
}

interface DeployResult {
  deployedAddress: string;
  nftImplementationAddress: string;
  setupAddress: string;
  implementationAddress: string;
}

async function deployNFTBridge(params: DeployParams): Promise<DeployResult> {
  console.log("Deploying NFT Bridge contracts...");
  console.log("Parameters:", params);

  // Deploy NFTImplementation contract
  const NFTImplementation = await ethers.getContractFactory("NFTImplementation");
  const nftImplementation = await NFTImplementation.deploy();
  await nftImplementation.deployed();
  console.log("NFTImplementation deployed to:", nftImplementation.address);

  // Deploy NFTBridgeSetup contract
  const NFTBridgeSetup = await ethers.getContractFactory("NFTBridgeSetup");
  const nftBridgeSetup = await NFTBridgeSetup.deploy();
  await nftBridgeSetup.deployed();
  console.log("NFTBridgeSetup deployed to:", nftBridgeSetup.address);

  // Deploy NFTBridgeImplementation contract
  const NFTBridgeImplementation = await ethers.getContractFactory("NFTBridgeImplementation");
  const nftBridgeImplementation = await NFTBridgeImplementation.deploy();
  await nftBridgeImplementation.deployed();
  console.log("NFTBridgeImplementation deployed to:", nftBridgeImplementation.address);

  // Prepare init data - matching Foundry script exactly:
  // "setup(address,uint16,address,uint16,bytes32,address,uint8,uint256)"
  const initData = nftBridgeSetup.interface.encodeFunctionData("setup", [
    nftBridgeImplementation.address, // address implementation
    params.chainId,                 // uint16 chainId
    params.wormhole,               // address wormhole
    params.governanceChainId,      // uint16 governanceChainId
    params.governanceContract,     // bytes32 governanceContract
    nftImplementation.address,     // address nftImplementation
    params.finality,              // uint8 finality
    params.evmChainId            // uint256 evmChainId
  ]);

  // Deploy NFTBridgeEntrypoint proxy with setup and init data
  const NFTBridgeEntrypoint = await ethers.getContractFactory("NFTBridgeEntrypoint");
  const nftBridge = await NFTBridgeEntrypoint.deploy(nftBridgeSetup.address, initData);
  await nftBridge.deployed();
  console.log("NFTBridgeEntrypoint deployed to:", nftBridge.address);

  console.log("NFT Bridge deployment completed successfully!");

  return {
    deployedAddress: nftBridge.address,
    nftImplementationAddress: nftImplementation.address,
    setupAddress: nftBridgeSetup.address,
    implementationAddress: nftBridgeImplementation.address
  };
}

// Main function for direct script execution
async function main() {
  // Default parameters - adjust for your needs
  const defaultParams: DeployParams = {
    chainId: 1,
    governanceChainId: 1,
    governanceContract: "0x0000000000000000000000000000000000000000000000000000000000000004",
    finality: 15,
    evmChainId: 420420420, // polkavm chain id
    wormhole: "0x0000000000000000000000000000000000000001" // Replace with deployed Wormhole address
  };

  const result = await deployNFTBridge(defaultParams);
  
  console.log("Final result:");
  console.log("- NFTBridge (proxy):", result.deployedAddress);
  console.log("- NFTImplementation:", result.nftImplementationAddress);
  console.log("- Setup:", result.setupAddress);
  console.log("- Implementation:", result.implementationAddress);

  return result;
}

// Export for use in other scripts
export { deployNFTBridge, DeployParams, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}