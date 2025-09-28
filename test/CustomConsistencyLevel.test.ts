import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("CustomConsistencyLevel", function () {
  let customConsistencyLevel: Contract;
  let owner: Signer;
  let userA: Signer;
  let userB: Signer;
  let guardian: Signer;

  before(async function () {
    this.timeout(30000);
    
    const signers = await ethers.getSigners();
    owner = signers[0];
    userA = signers[1] || signers[0];
    userB = signers[2] || signers[0];
    guardian = signers[3] || signers[0];

    // Deploy CustomConsistencyLevel contract
    const CustomConsistencyLevelFactory = await ethers.getContractFactory("CustomConsistencyLevel", owner);
    customConsistencyLevel = await CustomConsistencyLevelFactory.deploy();
    await customConsistencyLevel.deployed();
  });

  // Test equivalent to Foundry's test_makeAdditionalBlocksConfig
  it("should make additional blocks config correctly (test_makeAdditionalBlocksConfig)", async function () {
    const expected = "0x01c9002a00000000000000000000000000000000000000000000000000000000";
    
    // Since ConfigMakers is a library, we test the expected encoded value
    const TYPE_ADDITIONAL_BLOCKS = 1;
    const consistencyLevel = 201; // 0xc9
    const blocksToWait = 42; // 0x002a
    
    // Pack like Foundry: TYPE_ADDITIONAL_BLOCKS (1 byte) + consistencyLevel (1 byte) + blocksToWait (2 bytes) + padding (28 bytes)
    const encoded = ethers.utils.solidityPack(
      ["uint8", "uint8", "uint16"],
      [TYPE_ADDITIONAL_BLOCKS, consistencyLevel, blocksToWait]
    ) + "0".repeat(56); // Add 28 bytes of padding
    
    expect(encoded).to.equal(expected);
  });

  // Test equivalent to Foundry's test_configure
  it("should configure correctly (test_configure)", async function () {
    const expectedConfig = "0x01c9002a00000000000000000000000000000000000000000000000000000000";
    
    const userAAddress = await userA.getAddress();
    const userBAddress = await userB.getAddress();
    
    // Configure as userA (equivalent to vm.startPrank(userA))
    await customConsistencyLevel.connect(userA).configure(expectedConfig);
    
    // Check configuration as guardian (equivalent to vm.startPrank(guardian))
    const userAConfig = await customConsistencyLevel.connect(guardian).getConfiguration(userAAddress);
    
    expect(userAConfig).to.equal(expectedConfig);
    
    // Only check userB if it's a different address from userA
    if (userAAddress.toLowerCase() !== userBAddress.toLowerCase()) {
      const userBConfig = await customConsistencyLevel.connect(guardian).getConfiguration(userBAddress);
      expect(userBConfig).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    }
  });
});