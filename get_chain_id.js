const { ethers } = require("hardhat");

async function main() {
    const network = await ethers.provider.getNetwork();
    console.log("Network chainId:", network.chainId);
    console.log("Block chainId:", (await ethers.provider.getBlock("latest")).difficulty.toString());
}

main().catch(console.error);
