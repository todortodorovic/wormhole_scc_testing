import { ethers } from "hardhat";

interface DeployResult {
  deployedTokenAddress: string;
  deployedNFTaddress: string;
  deployedWETHaddress: string;
  deployedAccountantTokenAddress: string;
  transferVerificationTokenA: string;
}

async function deployTestToken(): Promise<DeployResult> {
  console.log("Deploying test tokens and NFTs...");

  const accounts = [
    "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
    "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
    "0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d",
    "0xd03ea8624C8C5987235048901fB614fDcA89b117",
    "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC",
    "0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9",
    "0x28a8746e75304c0780E011BEd21C72cD78cd535E",
    "0xACa94ef8bD5ffEE41947b4585a84BdA5a3d3DA6E",
    "0x1dF62f291b2E969fB0849d99D9Ce41e2F137006e",
    "0x610Bb1573d1046FCb8A70Bbbd395754cD57C2b60",
    "0x855FA758c77D68a04990E992aA4dcdeF899F654A",
    "0xfA2435Eacf10Ca62ae6787ba2fB044f8733Ee843",
    "0x64E078A8Aa15A41B85890265648e965De686bAE6"
  ];

  // Deploy ERC20 Test Token
  const ERC20PresetMinterPauser = await ethers.getContractFactory("ERC20PresetMinterPauser");
  const token = await ERC20PresetMinterPauser.deploy("Ethereum Test Token", "TKN");
  await token.deployed();
  console.log("Token deployed at:", token.address);

  // Mint 1000 units to first account
  await token.mint(accounts[0], ethers.utils.parseEther("1000"));

  // Deploy ERC721 Test NFT
  const ERC721PresetMinterPauserAutoId = await ethers.getContractFactory("ERC721PresetMinterPauserAutoId");
  const nft = await ERC721PresetMinterPauserAutoId.deploy(
    "Not an APE🐒",
    "APE🐒",
    "https://cloudflare-ipfs.com/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/"
  );
  await nft.deployed();

  // Mint 2 NFTs to first account
  await nft.mint(accounts[0]);
  await nft.mint(accounts[0]);
  console.log("NFT deployed at:", nft.address);

  // Deploy Mock WETH
  const MockWETH9 = await ethers.getContractFactory("MockWETH9");
  const mockWeth = await MockWETH9.deploy();
  await mockWeth.deployed();
  console.log("WETH token deployed at:", mockWeth.address);

  // Mint tokens to accounts 2-10
  for (let i = 2; i < 11; i++) {
    await token.mint(accounts[i], ethers.utils.parseEther("1000"));
  }

  // Deploy Accountant Test Token
  const accountantToken = await ERC20PresetMinterPauser.deploy("Accountant Test Token", "GA");
  await accountantToken.deployed();
  console.log("Accountant test token deployed at:", accountantToken.address);

  // Mint 1000 units to account 9
  await accountantToken.mint(accounts[9], ethers.utils.parseEther("1000"));

  // Deploy Transfer Verification Test Token A
  const deployedA = await ERC20PresetMinterPauser.deploy("TransferVerifier Test Token A", "TVA");
  await deployedA.deployed();
  console.log("Test token A deployed at:", deployedA.address);

  // Mint to account 13
  await deployedA.mint(accounts[13], ethers.utils.parseEther("1000"));
  await token.mint(accounts[13], ethers.utils.parseEther("1000"));

  console.log("Test token deployment completed successfully!");

  return {
    deployedTokenAddress: token.address,
    deployedNFTaddress: nft.address,
    deployedWETHaddress: mockWeth.address,
    deployedAccountantTokenAddress: accountantToken.address,
    transferVerificationTokenA: deployedA.address
  };
}

// Main function for direct script execution
async function main() {
  const result = await deployTestToken();
  
  console.log("Final result:");
  console.log("- Token:", result.deployedTokenAddress);
  console.log("- NFT:", result.deployedNFTaddress);
  console.log("- WETH:", result.deployedWETHaddress);
  console.log("- Accountant Token:", result.deployedAccountantTokenAddress);
  console.log("- Transfer Verification Token A:", result.transferVerificationTokenA);

  return result;
}

// Export for use in other scripts
export { deployTestToken, DeployResult };

// Run main function if script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}