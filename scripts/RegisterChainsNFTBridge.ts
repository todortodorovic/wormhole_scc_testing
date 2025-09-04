import { ethers } from "hardhat";

interface RegisterParams {
  nftBridge: string;
  registrationVaas: string[];
}

interface RegisterResult {
  registeredChains: number;
  success: boolean;
}

async function registerChainsNFTBridge(params: RegisterParams): Promise<RegisterResult> {
  console.log("Registering chains in NFT Bridge...");
  console.log("NFT Bridge Address:", params.nftBridge);
  console.log("Number of VAAs:", params.registrationVaas.length);

  // Get the NFTBridge contract
  const nftBridgeContract = await ethers.getContractAt("INFTBridge", params.nftBridge);

  // Register each chain
  let registeredCount = 0;
  for (let i = 0; i < params.registrationVaas.length; i++) {
    try {
      console.log(`Registering chain ${i + 1}/${params.registrationVaas.length}...`);
      const tx = await nftBridgeContract.registerChain(params.registrationVaas[i]);
      await tx.wait();
      registeredCount++;
      console.log(`Chain ${i + 1} registered successfully`);
    } catch (error) {
      console.error(`Failed to register chain ${i + 1}:`, error);
    }
  }

  const success = registeredCount === params.registrationVaas.length;
  console.log(`Chain registration completed! ${registeredCount}/${params.registrationVaas.length} chains registered successfully`);

  return {
    registeredChains: registeredCount,
    success
  };
}

// Main function for direct script execution
async function main() {
  // Example parameters - these would need to be provided by the user
  const defaultParams: RegisterParams = {
    nftBridge: "0x0000000000000000000000000000000000000000", // Replace with actual NFTBridge address
    registrationVaas: [] // Replace with actual VAAs
  };

  if (defaultParams.nftBridge === "0x0000000000000000000000000000000000000000") {
    console.log("Please provide a valid NFTBridge address and registration VAAs");
    console.log("Usage: npx hardhat run scripts/RegisterChainsNFTBridge.ts --network ethRpcNode");
    console.log("Make sure to update the script with actual parameters");
    return;
  }

  const result = await registerChainsNFTBridge(defaultParams);
  
  console.log("Final result:");
  console.log("- Registered Chains:", result.registeredChains);
  console.log("- Success:", result.success);

  return result;
}

// Export for use in other scripts
export { registerChainsNFTBridge, RegisterParams, RegisterResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}