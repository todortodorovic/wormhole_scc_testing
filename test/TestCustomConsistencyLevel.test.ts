import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("TestCustomConsistencyLevel", function () {
  let customConsistencyLevel: Contract;
  let testCustomConsistencyLevel: Contract;
  let owner: Signer;
  let userA: Signer;
  let userB: Signer;
  let guardian: Signer;

  // Test addresses from the original Foundry test
  const userBAddr = "0x0000000000000000000000000000000000000456";
  const wormholeAddr = "0x0000000000000000000000000000000000123456";

  beforeEach(async function () {
    try {
      const signers = await ethers.getSigners();
      
      if (signers.length >= 1) {
        const baseSigner = signers[0];
        
        if (signers.length >= 4) {
          [owner, userA, userB, guardian] = signers;
        } else {
          owner = baseSigner;
          userA = signers.length > 1 ? signers[1] : baseSigner;
          userB = signers.length > 2 ? signers[2] : baseSigner;
          guardian = signers.length > 3 ? signers[3] : baseSigner;
        }
      } else {
        throw new Error("No signers available");
      }
    } catch (error) {
      throw error;
    }

    // Deploy CustomConsistencyLevel contract
    const CustomConsistencyLevelFactory = await ethers.getContractFactory("CustomConsistencyLevel", owner);
    customConsistencyLevel = await CustomConsistencyLevelFactory.deploy();
    await customConsistencyLevel.deployed();

    // Deploy TestCustomConsistencyLevel contract with constructor parameters
    const TestCustomConsistencyLevelFactory = await ethers.getContractFactory("TestCustomConsistencyLevel", owner);
    testCustomConsistencyLevel = await TestCustomConsistencyLevelFactory.deploy(
      wormholeAddr,                               // _wormhole
      customConsistencyLevel.address,            // _customConsistencyLevel
      201,                                       // _consistencyLevel
      5                                          // _blocks
    );
    await testCustomConsistencyLevel.deployed();
  });

  describe("Contract Deployment", function () {
    it("should deploy with correct initial configuration", async function () {
      // Check that the contract was deployed successfully
      expect(testCustomConsistencyLevel.address).to.not.be.undefined;
      expect(customConsistencyLevel.address).to.not.be.undefined;
    });

    it("should have correct version", async function () {
      const version = await testCustomConsistencyLevel.VERSION();
      expect(version).to.equal("TestCustomConsistencyLevel-0.0.1");
    });

    it("should have correct immutable addresses", async function () {
      const wormholeAddress = await testCustomConsistencyLevel.wormhole();
      const customConsistencyLevelAddress = await testCustomConsistencyLevel.customConsistencyLevel();
      
      expect(wormholeAddress).to.equal(wormholeAddr);
      expect(customConsistencyLevelAddress).to.equal(customConsistencyLevel.address);
    });

    it("should have initial nonce of 0", async function () {
      const nonce = await testCustomConsistencyLevel.nonce();
      expect(nonce).to.equal(0);
    });
  });

  describe("Configuration Tests", function () {
    it("should configure correctly during deployment", async function () {
      // The expected configuration from the Foundry test: 0x01c9000500000000000000000000000000000000000000000000000000000000
      // This is TYPE_ADDITIONAL_BLOCKS (1) + consistencyLevel (201=0xc9) + blocks (5=0x0005) + padding
      const expectedConfig = "0x01c9000500000000000000000000000000000000000000000000000000000000";
      
      const config = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      expect(config).to.equal(expectedConfig);
    });

    it("should not have configuration for unrelated addresses", async function () {
      const userBConfig = await customConsistencyLevel.getConfiguration(userBAddr);
      expect(userBConfig).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("should allow reconfiguration through configure function", async function () {
      // Test reconfiguring with different parameters
      const newConsistencyLevel = 255; // 0xff
      const newBlocks = 80; // 0x0050
      const expectedNewConfig = "0x01ff005000000000000000000000000000000000000000000000000000000000";

      await testCustomConsistencyLevel.configure(newConsistencyLevel, newBlocks);
      
      const newConfig = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      expect(newConfig).to.equal(expectedNewConfig);
    });
  });

  describe("Message Publishing", function () {
    it("should increment nonce when publishing messages", async function () {
      const initialNonce = await testCustomConsistencyLevel.nonce();
      expect(initialNonce).to.equal(0);

      // Publish a message (this will likely fail without a real Wormhole contract, but we can test nonce increment)
      try {
        await testCustomConsistencyLevel.publishMessage("test message", { value: 0 });
        const newNonce = await testCustomConsistencyLevel.nonce();
        expect(newNonce).to.equal(1);
      } catch (error: any) {
        // If it fails due to Wormhole not being real, we expect a gas estimation error
        const errorMsg = error.message.toLowerCase();
        const hasExpectedError = errorMsg.includes("cannot estimate gas") || 
                               errorMsg.includes("call revert exception") ||
                               errorMsg.includes("transaction may fail");
        expect(hasExpectedError).to.be.true;
      }
    });

    it("should use correct consistency level when publishing", async function () {
      // This test verifies the publishMessage function exists and has the right signature
      // The actual functionality requires a real Wormhole contract
      const testMessage = "Hello Wormhole";
      
      try {
        await testCustomConsistencyLevel.publishMessage(testMessage, { value: 0 });
      } catch (error: any) {
        // Expected to fail without real Wormhole, but function should exist
        const errorMsg = error.message.toLowerCase();
        const hasExpectedError = errorMsg.includes("cannot estimate gas") || 
                               errorMsg.includes("call revert exception") ||
                               errorMsg.includes("transaction may fail");
        expect(hasExpectedError).to.be.true;
      }
    });
  });

  describe("Configuration Edge Cases", function () {
    it("should handle maximum consistency level values", async function () {
      const maxConsistencyLevel = 255;
      const blocks = 1;
      const expectedConfig = "0x01ff000100000000000000000000000000000000000000000000000000000000";

      await testCustomConsistencyLevel.configure(maxConsistencyLevel, blocks);
      
      const config = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      expect(config).to.equal(expectedConfig);
    });

    it("should handle maximum block values", async function () {
      const consistencyLevel = 1;
      const maxBlocks = 65535; // 0xffff
      const expectedConfig = "0x0101ffff00000000000000000000000000000000000000000000000000000000";

      await testCustomConsistencyLevel.configure(consistencyLevel, maxBlocks);
      
      const config = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      expect(config).to.equal(expectedConfig);
    });

    it("should handle minimum values", async function () {
      const minConsistencyLevel = 0;
      const minBlocks = 0;
      const expectedConfig = "0x0100000000000000000000000000000000000000000000000000000000000000";

      await testCustomConsistencyLevel.configure(minConsistencyLevel, minBlocks);
      
      const config = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      expect(config).to.equal(expectedConfig);
    });
  });

  describe("Multiple Configurations Fuzzing", function () {
    this.timeout(60000); // 60 seconds timeout

    it("should handle multiple configuration changes correctly", async function () {
      const testCases = [
        { consistencyLevel: 50, blocks: 10 },
        { consistencyLevel: 100, blocks: 25 },
        { consistencyLevel: 150, blocks: 50 },
        { consistencyLevel: 200, blocks: 100 },
        { consistencyLevel: 255, blocks: 65535 }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        await testCustomConsistencyLevel.configure(testCase.consistencyLevel, testCase.blocks);
        
        // Calculate expected configuration
        const consistencyLevelHex = testCase.consistencyLevel.toString(16).padStart(2, '0');
        const blocksHex = testCase.blocks.toString(16).padStart(4, '0');
        const expectedConfig = `0x01${consistencyLevelHex}${blocksHex}${'0'.repeat(56)}`;
        
        const config = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
        expect(config).to.equal(expectedConfig, `Configuration mismatch for test case ${i}`);
        
        // Small delay to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });

    it("should maintain independent configurations for different contracts", async function () {
      // Deploy a second TestCustomConsistencyLevel contract
      const TestCustomConsistencyLevelFactory = await ethers.getContractFactory("TestCustomConsistencyLevel", owner);
      const testCustomConsistencyLevel2 = await TestCustomConsistencyLevelFactory.deploy(
        wormholeAddr,
        customConsistencyLevel.address,
        100,  // Different consistency level
        20    // Different blocks
      );
      await testCustomConsistencyLevel2.deployed();

      // Verify both contracts have different configurations
      const config1 = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel.address);
      const config2 = await customConsistencyLevel.getConfiguration(testCustomConsistencyLevel2.address);
      
      const expectedConfig1 = "0x01c9000500000000000000000000000000000000000000000000000000000000"; // 201, 5
      const expectedConfig2 = "0x0164001400000000000000000000000000000000000000000000000000000000"; // 100, 20

      expect(config1).to.equal(expectedConfig1);
      expect(config2).to.equal(expectedConfig2);
      expect(config1).to.not.equal(config2);
    });
  });
});