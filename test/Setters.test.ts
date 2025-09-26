import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Setters", function () {
  let setters: Contract;
  let owner: Signer;
  let userA: Signer;

  // Storage slot constants from TestUtils.sol
  const CHAINID_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const GOVERNANCECONTRACT_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const GUARDIANSETS_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000002";
  const GUARDIANSETINDEX_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000003";
  const SEQUENCES_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000004";
  const CONSUMEDGOVACTIONS_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000005";
  const INITIALIZEDIMPLEMENTATIONS_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000006";
  const MESSAGEFEE_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000007";
  const EVMCHAINID_STORAGE_INDEX = "0x0000000000000000000000000000000000000000000000000000000000000008";

  // Max values from TestUtils.sol
  const MAX_UINT32 = 0xffffffff;

  // Helper functions from TestUtils.sol
  function hashedLocation(key: string, index: string): string {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [key, index]));
  }

  function hashedLocationBytes32(key: string, index: string): string {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [key, index]));
  }

  function hashedLocationOffset(key: number, index: string, offset: number): string {
    const hash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint32", "bytes32"], [key, index]));
    const hashNumber = ethers.BigNumber.from(hash);
    return ethers.utils.hexZeroPad(hashNumber.add(offset).toHexString(), 32);
  }

  async function getStorageAt(address: string, slot: string): Promise<string> {
    const value = await ethers.provider.getStorageAt(address, slot);
    return value === "0x" ? "0x0000000000000000000000000000000000000000000000000000000000000000" : value;
  }

   before(async function () {
    this.timeout(60000); 
    try {
      const signers = await ethers.getSigners();
      
      if (signers.length >= 2) {
        [owner, userA] = signers;
      } else {
        owner = signers[0];
        userA = signers.length > 1 ? signers[1] : signers[0];
      }
    } catch (error) {
      throw error;
    }

    // Deploy MySetters contract (wrapper for testing internal functions)
    const MySettersFactory = await ethers.getContractFactory("MySetters", owner);
    setters = await MySettersFactory.deploy();
    await setters.deployed();
  });

  describe("testUpdateGuardianSetIndex", function () {
    it("should update guardian set index with exact bit manipulation", async function () {
      const index = 12345;
      const storageSlot = "0x1234567890123456789012345678901234567890123456789012345678901234"; // Different from target slot
      
      const originalSlot = await getStorageAt(setters.address, GUARDIANSETINDEX_STORAGE_INDEX);
      
      await setters.updateGuardianSetIndex_external(index);
      
      const updatedSlot = await getStorageAt(setters.address, GUARDIANSETINDEX_STORAGE_INDEX);
      
      // Exact bit manipulation from Foundry test
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000");
      const expectedSlot = ethers.BigNumber.from(index).or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
      
      // Verify unchanged storage (storageSlot should remain unchanged)
      const unchangedSlot = await getStorageAt(setters.address, storageSlot);
      expect(unchangedSlot).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("should handle fuzzing for guardian set index updates", async function () {
      this.timeout(60000);
      
      const testValues = [0, 1, 100, 1000, 65535, MAX_UINT32 - 1];
      
      for (const index of testValues) {
        const originalSlot = await getStorageAt(setters.address, GUARDIANSETINDEX_STORAGE_INDEX);
        
        await setters.updateGuardianSetIndex_external(index);
        
        const updatedSlot = await getStorageAt(setters.address, GUARDIANSETINDEX_STORAGE_INDEX);
        const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000");
        const expectedSlot = ethers.BigNumber.from(index).or(mask.and(ethers.BigNumber.from(originalSlot)));
        
        expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testExpireGuardianSet", function () {
    it("should expire guardian set with timestamp and bit manipulation", async function () {
      const index = 5;
      
      const storageLocation = hashedLocationOffset(index, GUARDIANSETS_STORAGE_INDEX, 1);
      const originalSlot = await getStorageAt(setters.address, storageLocation);
      
      // Get current block timestamp before calling expire
      const blockBefore = await ethers.provider.getBlock("latest");
      const timestampBefore = blockBefore.timestamp;
      
      await setters.expireGuardianSet_external(index);
      
      // Get block timestamp after the transaction
      const blockAfter = await ethers.provider.getBlock("latest");
      const timestampAfter = blockAfter.timestamp;
      
      const updatedSlot = await getStorageAt(setters.address, storageLocation);
      
      // Verify that expiration time was set (should be timestampAfter + 86400)
      const expectedTimestamp = timestampAfter + 86400;
      const actualTimestamp = ethers.BigNumber.from(updatedSlot).and("0x00000000000000000000000000000000000000000000000000000000ffffffff");
      
      expect(actualTimestamp.eq(expectedTimestamp)).to.be.true;
    });

    it("should handle fuzzing for guardian set expiration", async function () {
      this.timeout(60000);
      
      const testCases = [0, 1, 10, 100, 255]; // Different guardian set indices
      
      for (const index of testCases) {
        const storageLocation = hashedLocationOffset(index, GUARDIANSETS_STORAGE_INDEX, 1);
        const originalSlot = await getStorageAt(setters.address, storageLocation);
        
        // Get timestamp before transaction
        const blockBefore = await ethers.provider.getBlock("latest");
        const timestampBefore = blockBefore.timestamp;
        
        await setters.expireGuardianSet_external(index);
        
        // Get timestamp after transaction
        const blockAfter = await ethers.provider.getBlock("latest");
        const timestampAfter = blockAfter.timestamp;
        
        const updatedSlot = await getStorageAt(setters.address, storageLocation);
        const actualTimestamp = ethers.BigNumber.from(updatedSlot).and("0x00000000000000000000000000000000000000000000000000000000ffffffff");
        
        // Verify expiration time is set correctly (timestampAfter + 86400)
        const expectedTimestamp = timestampAfter + 86400;
        expect(actualTimestamp.eq(expectedTimestamp)).to.be.true;
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });
  });

  describe("testSetInitialized", function () {
    it("should set initialized implementation with exact bit manipulation", async function () {
      const newImplementation = await userA.getAddress();
      
      const storageLocation = hashedLocation(newImplementation, INITIALIZEDIMPLEMENTATIONS_STORAGE_INDEX);
      const originalSlot = await getStorageAt(setters.address, storageLocation);
      
      await setters.setInitialized_external(newImplementation);
      
      const updatedSlot = await getStorageAt(setters.address, storageLocation);
      
      // Exact bit manipulation from Foundry test
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00");
      const expectedSlot = ethers.BigNumber.from("0x01").or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
    });

    it("should handle fuzzing for implementation initialization", async function () {
      this.timeout(60000);
      
      const signers = await ethers.getSigners();
      const testImplementations = signers.slice(0, Math.min(5, signers.length));
      
      for (const signer of testImplementations) {
        const implementation = await signer.getAddress();
        const storageLocation = hashedLocation(implementation, INITIALIZEDIMPLEMENTATIONS_STORAGE_INDEX);
        const originalSlot = await getStorageAt(setters.address, storageLocation);
        
        await setters.setInitialized_external(implementation);
        
        const updatedSlot = await getStorageAt(setters.address, storageLocation);
        const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00");
        const expectedSlot = ethers.BigNumber.from("0x01").or(mask.and(ethers.BigNumber.from(originalSlot)));
        
        expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetGovernanceActionConsumed", function () {
    it("should set governance action consumed with exact bit manipulation", async function () {
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-governance-action"));
      
      const storageLocation = hashedLocationBytes32(hash, CONSUMEDGOVACTIONS_STORAGE_INDEX);
      const originalSlot = await getStorageAt(setters.address, storageLocation);
      
      await setters.setGovernanceActionConsumed_external(hash);
      
      const updatedSlot = await getStorageAt(setters.address, storageLocation);
      
      // Exact bit manipulation from Foundry test
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00");
      const expectedSlot = ethers.BigNumber.from("0x01").or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
    });

    it("should handle fuzzing for governance action consumption", async function () {
      this.timeout(60000);
      
      const testHashes = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("governance-action-1")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("governance-action-2")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("governance-action-3")),
        ethers.utils.randomBytes(32),
        ethers.utils.hexZeroPad("0x1", 32)
      ];
      
      for (const hash of testHashes) {
        const storageLocation = hashedLocationBytes32(ethers.utils.hexlify(hash), CONSUMEDGOVACTIONS_STORAGE_INDEX);
        const originalSlot = await getStorageAt(setters.address, storageLocation);
        
        await setters.setGovernanceActionConsumed_external(hash);
        
        const updatedSlot = await getStorageAt(setters.address, storageLocation);
        const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00");
        const expectedSlot = ethers.BigNumber.from("0x01").or(mask.and(ethers.BigNumber.from(originalSlot)));
        
        expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetChainId", function () {
    it("should set chain ID with exact bit manipulation", async function () {
      const newChainId = 1337;
      
      const originalSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
      
      await setters.setChainId_external(newChainId);
      
      const updatedSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
      
      // Exact bit manipulation from Foundry test
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000");
      const expectedSlot = ethers.BigNumber.from(newChainId).or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
    });

    it("should handle fuzzing for chain ID updates", async function () {
      this.timeout(60000);
      
      const testChainIds = [1, 2, 56, 137, 1337, 31337, 65535];
      
      for (const chainId of testChainIds) {
        const originalSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
        
        await setters.setChainId_external(chainId);
        
        const updatedSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
        const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000");
        const expectedSlot = ethers.BigNumber.from(chainId).or(mask.and(ethers.BigNumber.from(originalSlot)));
        
        expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetGovernanceChainId", function () {
    it("should set governance chain ID with exact bit manipulation", async function () {
      const newChainId = 2;
      
      const originalSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
      
      await setters.setGovernanceChainId_external(newChainId);
      
      const updatedSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
      
      // Exact bit manipulation from Foundry test (uint256(newChainId) << 16)
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000ffff");
      const shiftedChainId = ethers.BigNumber.from(newChainId).shl(16);
      const expectedSlot = shiftedChainId.or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
    });

    it("should handle fuzzing for governance chain ID updates", async function () {
      this.timeout(60000);
      
      const testChainIds = [1, 2, 10, 100, 1000, 65535];
      
      for (const chainId of testChainIds) {
        const originalSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
        
        await setters.setGovernanceChainId_external(chainId);
        
        const updatedSlot = await getStorageAt(setters.address, CHAINID_STORAGE_INDEX);
        const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000ffff");
        const shiftedChainId = ethers.BigNumber.from(chainId).shl(16);
        const expectedSlot = shiftedChainId.or(mask.and(ethers.BigNumber.from(originalSlot)));
        
        expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetGovernanceContract", function () {
    it("should set governance contract directly", async function () {
      const newGovernanceContract = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new-governance-contract"));
      
      await setters.setGovernanceContract_external(newGovernanceContract);
      
      const updatedSlot = await getStorageAt(setters.address, GOVERNANCECONTRACT_STORAGE_INDEX);
      expect(updatedSlot).to.equal(newGovernanceContract);
    });

    it("should handle fuzzing for governance contract updates", async function () {
      this.timeout(60000);
      
      const testContracts = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("governance-1")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("governance-2")),
        ethers.utils.randomBytes(32),
        ethers.utils.hexZeroPad("0x1", 32),
        ethers.utils.hexZeroPad("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 32)
      ];
      
      for (const contract of testContracts) {
        await setters.setGovernanceContract_external(contract);
        
        const updatedSlot = await getStorageAt(setters.address, GOVERNANCECONTRACT_STORAGE_INDEX);
        expect(updatedSlot).to.equal(ethers.utils.hexlify(contract));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetMessageFee", function () {
    it("should set message fee directly", async function () {
      const newFee = ethers.utils.parseEther("0.001");
      
      await setters.setMessageFee_external(newFee);
      
      const updatedSlot = await getStorageAt(setters.address, MESSAGEFEE_STORAGE_INDEX);
      const expectedSlot = ethers.utils.hexZeroPad(newFee.toHexString(), 32);
      
      expect(updatedSlot).to.equal(expectedSlot);
    });

    it("should handle fuzzing for message fee updates", async function () {
      this.timeout(60000);
      
      const testFees = [
        ethers.BigNumber.from(0),
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.01"),
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("100"),
        ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      ];
      
      for (const fee of testFees) {
        await setters.setMessageFee_external(fee);
        
        const updatedSlot = await getStorageAt(setters.address, MESSAGEFEE_STORAGE_INDEX);
        const expectedSlot = ethers.utils.hexZeroPad(fee.toHexString(), 32);
        
        expect(updatedSlot).to.equal(expectedSlot);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testSetNextSequence", function () {
    it("should set next sequence with exact bit manipulation", async function () {
      const emitter = await userA.getAddress();
      const sequence = 12345;
      
      const storageLocation = hashedLocation(emitter, SEQUENCES_STORAGE_INDEX);
      const originalSlot = await getStorageAt(setters.address, storageLocation);
      
      await setters.setNextSequence_external(emitter, sequence);
      
      const updatedSlot = await getStorageAt(setters.address, storageLocation);
      
      // Exact bit manipulation from Foundry test
      const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000");
      const expectedSlot = ethers.BigNumber.from(sequence).or(mask.and(ethers.BigNumber.from(originalSlot)));
      
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
    });

    it("should handle fuzzing for sequence updates", async function () {
      this.timeout(60000);
      
      const signers = await ethers.getSigners();
      const testEmitters = signers.slice(0, Math.min(3, signers.length));
      const testSequences = [0, 1, 1000, 65535, 4294967295]; // Various uint64 values
      
      for (const signer of testEmitters) {
        for (const sequence of testSequences) {
          const emitter = await signer.getAddress();
          const storageLocation = hashedLocation(emitter, SEQUENCES_STORAGE_INDEX);
          const originalSlot = await getStorageAt(setters.address, storageLocation);
          
          await setters.setNextSequence_external(emitter, sequence);
          
          const updatedSlot = await getStorageAt(setters.address, storageLocation);
          const mask = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000");
          const expectedSlot = ethers.BigNumber.from(sequence).or(mask.and(ethers.BigNumber.from(originalSlot)));
          
          expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(expectedSlot.toHexString(), 32));
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    });
  });

  describe("testSetEvmChainId", function () {
    it("should set EVM chain ID successfully when matching current chain", async function () {
      const network = await ethers.provider.getNetwork();
      const currentChainId = network.chainId;
      
      // Simulate vm.chainId(currentChainId) - not directly possible in Hardhat
      await setters.setEvmChainId_external(currentChainId);
      
      const updatedSlot = await getStorageAt(setters.address, EVMCHAINID_STORAGE_INDEX);
      const expectedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(currentChainId).toHexString(), 32);
      
      expect(updatedSlot).to.equal(expectedSlot);
    });

    it("should revert when setting mismatched EVM chain ID", async function () {
      const network = await ethers.provider.getNetwork();
      const currentChainId = network.chainId;
      const differentChainId = currentChainId === 1 ? 2 : 1;
      
      try {
        await setters.setEvmChainId_external(differentChainId);
        throw new Error("Expected transaction to revert with 'invalid evmChainId'");
      } catch (error: any) {
        expect(error.message).to.include("invalid evmChainId");
      }
    });

    it("should handle fuzzing for EVM chain ID boundaries", async function () {
      this.timeout(60000);
      
      const network = await ethers.provider.getNetwork();
      const currentChainId = network.chainId;
      
      // Test with current chain ID (should succeed)
      await setters.setEvmChainId_external(currentChainId);
      const updatedSlot = await getStorageAt(setters.address, EVMCHAINID_STORAGE_INDEX);
      expect(updatedSlot).to.equal(ethers.utils.hexZeroPad(ethers.BigNumber.from(currentChainId).toHexString(), 32));
      
      // Test with different chain IDs (should revert)
      const testChainIds = [0, 1, 2, 56, 137, 1337];
      
      for (const chainId of testChainIds) {
        if (chainId === currentChainId) continue;
        
        try {
          await setters.setEvmChainId_external(chainId);
          throw new Error(`Expected revert for chain ID ${chainId}`);
        } catch (error: any) {
          expect(error.message).to.include("invalid evmChainId");
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });
});