import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("TestCustomConsistencyLevel", function () {
  let customConsistencyLevel: Contract;
  let testCustomConsistencyLevel: Contract;
  let owner: Signer;
  let guardian: Signer;

  // Test addresses matching Foundry test
  const userBAddr = "0x0000000000000000000000000000000000000456";
  const wormholeAddr = "0x0000000000000000000000000000000000123456";

  before(async function () {
    this.timeout(60000); 
    
    const signers = await ethers.getSigners();
    owner = signers[0];
    guardian = signers[1] || signers[0];

    // Deploy CustomConsistencyLevel contract
    const CustomConsistencyLevelFactory = await ethers.getContractFactory("CustomConsistencyLevel", owner);
    customConsistencyLevel = await CustomConsistencyLevelFactory.deploy();
    await customConsistencyLevel.deployed();

    // Deploy TestCustomConsistencyLevel contract with constructor parameters
    const TestCustomConsistencyLevelFactory = await ethers.getContractFactory("TestCustomConsistencyLevel", owner);
    testCustomConsistencyLevel = await TestCustomConsistencyLevelFactory.deploy(
      wormholeAddr,                    // _wormhole
      customConsistencyLevel.address, // _customConsistencyLevel
      201,                            // _consistencyLevel
      5                               // _blocks
    );
    await testCustomConsistencyLevel.deployed();
  });

  it("should configure correctly (test_configure)", async function () {
    // Expected configuration: 0x01c9000500000000000000000000000000000000000000000000000000000000
    // This is TYPE_ADDITIONAL_BLOCKS (1) + consistencyLevel (201=0xc9) + blocks (5=0x0005) + padding
    const expectedConfig = "0x01c9000500000000000000000000000000000000000000000000000000000000";
    
    const config = await customConsistencyLevel.connect(guardian).getConfiguration(testCustomConsistencyLevel.address);
    expect(config).to.equal(expectedConfig);

    const userBConfig = await customConsistencyLevel.connect(guardian).getConfiguration(userBAddr);
    expect(userBConfig).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  });
});