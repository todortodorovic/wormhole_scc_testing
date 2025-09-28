import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Messages", function () {
  let messages: Contract;
  let owner: Signer;
  // let testGuardianSigner: Signer; // Unused in current implementation
  let alice: Signer;
  let guardianSet: any;
  
  // Test constants from the original Foundry test
  const testGuardianPub = "0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe";
  const validVM = "0x01000000000100867b55fec41778414f0683e80a430b766b78801b7070f9198ded5e62f48ac7a44b379a6cf9920e42dbd06c5ebf5ec07a934a00a572aefc201e9f91c33ba766d900000003e800000001000b0000000000000000000000000000000000000000000000000000000000000eee00000000000005390faaaa";
  
  // Private key for testGuardianPub (from Foundry test)
  const testGuardianPrivateKey = "0xcfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

  before(async function () {
    this.timeout(30000); // Increased timeout for one-time deployment
    try {
      const signers = await ethers.getSigners();
      
      if (signers.length >= 1) {
        const baseSigner = signers[0];
        
        if (signers.length >= 2) {
          [owner, alice] = signers;
        } else {
          owner = baseSigner;
          alice = signers.length > 1 ? signers[1] : baseSigner;
        }
      } else {
        throw new Error("No signers available");
      }
    } catch (error) {
      throw error;
    }

    // Deploy the ExportedMessages contract (wrapper that includes Setters)
    const ExportedMessagesFactory = await ethers.getContractFactory("ExportedMessages", owner);
    messages = await ExportedMessagesFactory.deploy();
    await messages.deployed();

    // Initialize guardian set with one guardian
    guardianSet = {
      keys: [testGuardianPub],
      expirationTime: 0
    };

    // Store guardian set for testing
    await messages.storeGuardianSetPub(guardianSet, 0);
    
    // Verify quorum setup
    const quorum = await messages.quorum(guardianSet.keys.length);
    expect(quorum.toNumber()).to.equal(1, "Quorum should be 1");
  });

  // Test equivalent to Foundry's testQuorum
  it("should calculate quorum correctly", async function () {
    expect((await messages.quorum(0)).toNumber()).to.equal(1);
    expect((await messages.quorum(1)).toNumber()).to.equal(1);
    expect((await messages.quorum(2)).toNumber()).to.equal(2);
    expect((await messages.quorum(3)).toNumber()).to.equal(3);
    expect((await messages.quorum(4)).toNumber()).to.equal(3);
    expect((await messages.quorum(5)).toNumber()).to.equal(4);
    expect((await messages.quorum(6)).toNumber()).to.equal(5);
    expect((await messages.quorum(7)).toNumber()).to.equal(5);
    expect((await messages.quorum(8)).toNumber()).to.equal(6);
    expect((await messages.quorum(9)).toNumber()).to.equal(7);
    expect((await messages.quorum(10)).toNumber()).to.equal(7);
    expect((await messages.quorum(11)).toNumber()).to.equal(8);
    expect((await messages.quorum(12)).toNumber()).to.equal(9);
    expect((await messages.quorum(19)).toNumber()).to.equal(13);
    expect((await messages.quorum(20)).toNumber()).to.equal(14);
  });

  // Test equivalent to Foundry's testQuorumCanAlwaysBeReached (fuzzing)
  it("should ensure quorum can always be reached (fuzzing)", async function () {
    this.timeout(60000);
    
    // Simulate Foundry fuzzing with predefined test values
    const testValues = [1, 2, 3, 5, 10, 20, 50, 100, 150, 200, 255, 256];
    
    for (const numGuardians of testValues) {
      if (numGuardians >= 256) {
        try {
          await messages.quorum(numGuardians);
          throw new Error(`Expected revert for ${numGuardians} guardians`);
        } catch (error: any) {
          expect(error.message).to.include("too many guardians");
        }
      } else {
        const quorum = await messages.quorum(numGuardians);
        expect(quorum.toNumber()).to.be.lessThanOrEqual(numGuardians);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });

  // Test equivalent to Foundry's testCannotVerifySignaturesWithOutOfBoundsSignature (fuzzing)
  it("should reject signatures with out of bounds guardian index (fuzzing)", async function () {
    this.timeout(30000);
    
    // Simulate Foundry fuzzing with predefined test messages
    const testMessages = [
      "0x4f7574206f6620626f756e64732074657374", // "Out of bounds test"
      "0x477561726469616e20696e64657820746573742031", // "Guardian index test 1"
      "0x477561726469616e20696e64657820746573742032"  // "Guardian index test 2"
    ];
    
    for (const encoded of testMessages) {
      const messageHash = ethers.utils.keccak256(encoded);
      
      // Generate legitimate signature by signing the raw hash directly
      const signingKey = new ethers.utils.SigningKey(testGuardianPrivateKey);
      const signature = signingKey.signDigest(messageHash);
      
      // Create good signature
      const goodSignature = {
        r: signature.r,
        s: signature.s,
        v: signature.v,
        guardianIndex: 0
      };
      
      // Create out of bounds signature (reuse same signature but with invalid index)
      const outOfBoundsSignature = {
        r: signature.r,
        s: signature.s,
        v: signature.v,
        guardianIndex: 1 // Out of bounds for our guardian set of size 1
      };

      // Attempt to verify signatures with out of bounds index
      try {
        await messages.verifySignatures(messageHash, [goodSignature, outOfBoundsSignature], guardianSet);
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("guardian index out of bounds");
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  // Test equivalent to Foundry's testCannotVerifySignaturesWithInvalidSignature (fuzzing)
  it("should reject invalid signatures (fuzzing)", async function () {
    this.timeout(30000);
    
    // Simulate Foundry fuzzing with predefined test messages
    const testMessages = [
      "0x496e76616c6964207369676e6174757265207465737420", // "Invalid signature test"
      "0x4261642073696720746573742032" // "Bad sig test 2"
    ];
    
    for (const encoded of testMessages) {
      const messageHash = ethers.utils.keccak256(encoded);
      
      // Generate an invalid signature (all zeros like Foundry test)
      const badSignature = {
        r: "0x0000000000000000000000000000000000000000000000000000000000000000",
        s: "0x0000000000000000000000000000000000000000000000000000000000000000", 
        v: 0,
        guardianIndex: 0
      };

      // Attempt to verify invalid signature
      try {
        await messages.verifySignatures(messageHash, [badSignature], guardianSet);
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("ecrecover failed with signature");
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  // Test equivalent to Foundry's testVerifySignatures (fuzzing)
  it("should verify valid signatures correctly (fuzzing)", async function () {
    this.timeout(30000);
    
    // Simulate Foundry fuzzing with predefined test messages
    const testMessages = [
      "0x48656c6c6f20576f726c64", // "Hello World" 
      "0x54657374204d65737361676520313233", // "Test Message 123"
      "0x46757a7a696e6720546573742044617461", // "Fuzzing Test Data"
    ];
    
    for (const encoded of testMessages) {
      const messageHash = ethers.utils.keccak256(encoded);
      
      // Generate legitimate signature by signing the raw hash directly
      const signingKey = new ethers.utils.SigningKey(testGuardianPrivateKey);
      const signature = signingKey.signDigest(messageHash);
      
      // Create signature struct
      const goodSignature = {
        r: signature.r,
        s: signature.s,
        v: signature.v,
        guardianIndex: 0
      };

      // Verify signature using the contract
      const result = await messages.verifySignatures(messageHash, [goodSignature], guardianSet);
      expect(result[0]).to.be.true; // valid
      expect(result[1]).to.equal(""); // empty reason
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  // Test equivalent to Foundry's testHashMismatchedVMIsNotVerified
  it("should reject VM with hash mismatch", async function () {
    // Set up guardian set for VM verification
    const initialGuardians = [testGuardianPub];
    const initialGuardianSet = {
      keys: initialGuardians,
      expirationTime: 0
    };

    await messages.storeGuardianSetPub(initialGuardianSet, 0);

    // First confirm that the test VM is valid
    const parseResult = await messages.parseAndVerifyVM(validVM);
    const [parsedValidVM, valid, reason] = parseResult;
    
    expect(valid).to.be.true;
    expect(reason).to.equal("");

    // Create invalid VM by manipulating the payload  
    const maliciousPayload = parsedValidVM.payload + "deadbeef"; // Add malicious bytes

    const invalidVM = {
      ...parsedValidVM,
      payload: maliciousPayload
    };

    // Verify that the verifyVM fails on invalid VM
    const verifyResult = await messages.verifyVM(invalidVM);
    const [invalidValid, invalidReason] = verifyResult;
    
    expect(invalidValid).to.be.false;
    expect(invalidReason).to.equal("vm.hash doesn't match body");
  });
});