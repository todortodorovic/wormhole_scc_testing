import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { SigningKey } from "ethers/lib/utils";



interface GuardianSetParams {
  privateKeys: string[];
  guardianCount: number;
  expirationTime: number;
}

interface GuardianSet {
  keys: string[];
  expirationTime: number;
}

interface Signature {
  r: string;
  s: string;
  v: number;
  guardianIndex: number;
}

describe("MessagesRV", function () {
  let messages: Contract;
  let owner: Signer;

  const SECP256K1_CURVE_ORDER = ethers.BigNumber.from("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const MAX_UINT8 = 255;

  beforeEach(async function () {
    try {
      const signers = await ethers.getSigners();
      owner = signers[0];
    } catch (error) {
      throw error;
    }

    // Deploy Messages contract
    const MessagesFactory = await ethers.getContractFactory("Messages", owner);
    messages = await MessagesFactory.deploy();
    await messages.deployed();
  });

  function paramsAreWellFormed(params: GuardianSetParams): boolean {
    return params.guardianCount <= 19 && 
           params.guardianCount <= params.privateKeys.length &&
           params.guardianCount > 0;
  }

  function generateGuardianSet(params: GuardianSetParams): GuardianSet {
    // Validate all private keys are in valid range
    for (let i = 0; i < params.guardianCount; i++) {
      const pkBN = ethers.BigNumber.from(params.privateKeys[i]);
      if (pkBN.lte(0) || pkBN.gte(SECP256K1_CURVE_ORDER)) {
        throw new Error(`Invalid private key at index ${i}`);
      }
    }

    const guardians: string[] = [];
    for (let i = 0; i < params.guardianCount; i++) {
      const address = ethers.utils.computeAddress(params.privateKeys[i]);
      guardians.push(address);
    }

    return {
      keys: guardians,
      expirationTime: params.expirationTime
    };
  }

  function generateSignature(
    index: number,
    privateKey: string, 
    guardian: string,
    message: string
  ): Signature {
    const signingKey = new SigningKey(privateKey);
    const messageHash = ethers.utils.arrayify(message);
    const signature = signingKey.signDigest(messageHash);
    
    // Verify signature matches guardian
    const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
    if (recoveredAddress.toLowerCase() !== guardian.toLowerCase()) {
      throw new Error("Signature verification failed during generation");
    }

    return {
      r: signature.r,
      s: signature.s, 
      v: signature.v,
      guardianIndex: index
    };
  }

  function generateSignatures(
    privateKeys: string[],
    guardians: string[],
    message: string
  ): Signature[] {
    const signatures: Signature[] = [];
    
    for (let i = 0; i < guardians.length; i++) {
      const sig = generateSignature(i, privateKeys[i], guardians[i], message);
      signatures.push(sig);
    }

    return signatures;
  }


  // Helper to generate valid private keys
  function generateValidPrivateKeys(count: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate random private key in valid range
      let privateKey: string;
      do {
        privateKey = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      } while (
        ethers.BigNumber.from(privateKey).lte(0) || 
        ethers.BigNumber.from(privateKey).gte(SECP256K1_CURVE_ORDER)
      );
      keys.push(privateKey);
    }
    return keys;
  }

  describe("testCannotVerifySignaturesWithOutOfBoundsSignature", function () {
    it("should revert when guardian index is out of bounds", async function () {
      this.timeout(60000);
      
      const testData = "0x1234567890abcdef";
      const guardianCount = 3;
      const params: GuardianSetParams = {
        privateKeys: generateValidPrivateKeys(guardianCount),
        guardianCount: guardianCount,
        expirationTime: Math.floor(Date.now() / 1000) + 3600
      };

      const message = ethers.utils.keccak256(testData);
      const guardianSet = generateGuardianSet(params);
      const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

      // Make first signature out of bounds
      signatures[0].guardianIndex = guardianCount + 1;

      try {
        await messages.verifySignatures(message, signatures, guardianSet);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("guardian index out of bounds");
      }
    });

    it("should handle fuzzing for out of bounds guardian indices", async function () {
      this.timeout(120000);

      const testCases = [
        { guardianCount: 2, outOfBoundsIndex: 2 },
        { guardianCount: 3, outOfBoundsIndex: 5 }, 
        { guardianCount: 5, outOfBoundsIndex: 10 }
      ];

      for (const testCase of testCases) {
        const testData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        const params: GuardianSetParams = {
          privateKeys: generateValidPrivateKeys(testCase.guardianCount),
          guardianCount: testCase.guardianCount,
          expirationTime: Math.floor(Date.now() / 1000) + 3600
        };

        const message = ethers.utils.keccak256(testData);
        const guardianSet = generateGuardianSet(params);
        const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

        // Set out of bounds index
        signatures[0].guardianIndex = testCase.outOfBoundsIndex;

        try {
          await messages.verifySignatures(message, signatures, guardianSet);
          expect.fail("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("guardian index out of bounds");
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("testCannotVerifySignaturesWithInvalidSignature1", function () {
    it("should handle invalid fake signatures", async function () {
      this.timeout(60000);

      const testData = "0xabcdef1234567890";  
      const guardianCount = 3;
      const params: GuardianSetParams = {
        privateKeys: generateValidPrivateKeys(guardianCount),
        guardianCount: guardianCount,
        expirationTime: Math.floor(Date.now() / 1000) + 3600
      };

      const message = ethers.utils.keccak256(testData);
      const guardianSet = generateGuardianSet(params);
      const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

      // Create fake signature
      const fakeSignature: Signature = {
        r: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
        s: ethers.utils.hexlify(ethers.utils.randomBytes(32)), 
        v: 27,
        guardianIndex: 1
      };

      signatures[1] = fakeSignature;

      try {
        const result = await messages.verifySignatures(message, signatures, guardianSet);
        // If call succeeds, signature was recoverable but invalid
        expect(result.valid).to.equal(false);
        expect(result.reason).to.equal("VM signature invalid");
      } catch (error: any) {
        // If call reverts, signature was completely invalid
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("ecrecover failed with signature") || 
          msg.includes("invalid signature") ||
          msg.includes("revert")
        );
      }
    });

    it("should handle fuzzing for various fake signatures", async function () {
      this.timeout(120000);

      for (let i = 0; i < 5; i++) {
        const testData = ethers.utils.hexlify(ethers.utils.randomBytes(20));
        const guardianCount = 2 + (i % 3); // 2, 3, or 4 guardians
        const params: GuardianSetParams = {
          privateKeys: generateValidPrivateKeys(guardianCount),
          guardianCount: guardianCount,
          expirationTime: Math.floor(Date.now() / 1000) + 3600
        };

        const message = ethers.utils.keccak256(testData);
        const guardianSet = generateGuardianSet(params);
        const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

        // Replace random signature with fake one
        const fakeIndex = i % guardianCount;
        const fakeSignature: Signature = {
          r: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
          s: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
          v: 27 + (i % 2),
          guardianIndex: fakeIndex
        };

        signatures[fakeIndex] = fakeSignature;

        try {
          const result = await messages.verifySignatures(message, signatures, guardianSet);
          // If call succeeds, signature was recoverable but invalid
          expect(result.valid).to.equal(false);
          expect(result.reason).to.equal("VM signature invalid");
        } catch (error: any) {
          // If call reverts, signature was completely invalid
          expect(error.message).to.satisfy((msg: string) => 
            msg.includes("ecrecover failed with signature") || 
            msg.includes("invalid signature") ||
            msg.includes("revert")
          );
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });
  });

  describe("testCannotVerifySignaturesWithInvalidSignature2", function () {
    it("should reject signature from wrong private key for correct guardian index", async function () {
      this.timeout(60000);

      const testData = "0xdeadbeefcafe1234";
      const guardianCount = 4;
      const params: GuardianSetParams = {
        privateKeys: generateValidPrivateKeys(guardianCount),
        guardianCount: guardianCount,
        expirationTime: Math.floor(Date.now() / 1000) + 3600
      };

      const message = ethers.utils.keccak256(testData);
      const guardianSet = generateGuardianSet(params);
      const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

      // Generate signature with different private key for same index
      const fakePrivateKey = generateValidPrivateKeys(1)[0];
      const fakeGuardianIndex = 2;
      const fakeGuardianAddress = ethers.utils.computeAddress(fakePrivateKey);
      
      // Ensure it's different from original guardian
      if (fakeGuardianAddress.toLowerCase() !== guardianSet.keys[fakeGuardianIndex].toLowerCase()) {
        const fakeSignature = generateSignature(
          fakeGuardianIndex,
          fakePrivateKey,
          fakeGuardianAddress,
          message
        );

        signatures[fakeGuardianIndex] = fakeSignature;

        const result = await messages.verifySignatures(message, signatures, guardianSet);
        expect(result.valid).to.equal(false);
        expect(result.reason).to.equal("VM signature invalid");
      }
    });

    it("should handle fuzzing for signatures with wrong private keys", async function () {
      this.timeout(120000);

      for (let i = 0; i < 4; i++) {
        const testData = ethers.utils.hexlify(ethers.utils.randomBytes(16));
        const guardianCount = 3;
        const params: GuardianSetParams = {
          privateKeys: generateValidPrivateKeys(guardianCount),
          guardianCount: guardianCount,
          expirationTime: Math.floor(Date.now() / 1000) + 3600
        };

        const message = ethers.utils.keccak256(testData);
        const guardianSet = generateGuardianSet(params);
        const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

        // Generate different private key
        const fakePrivateKey = generateValidPrivateKeys(1)[0];
        const fakeGuardianIndex = i % guardianCount;
        const fakeGuardianAddress = ethers.utils.computeAddress(fakePrivateKey);

        // Ensure different from original
        if (fakeGuardianAddress.toLowerCase() !== guardianSet.keys[fakeGuardianIndex].toLowerCase()) {
          const fakeSignature = generateSignature(
            fakeGuardianIndex,
            fakePrivateKey,
            fakeGuardianAddress,
            message
          );

          signatures[fakeGuardianIndex] = fakeSignature;

          const result = await messages.verifySignatures(message, signatures, guardianSet);
          expect(result.valid).to.equal(false);
          expect(result.reason).to.equal("VM signature invalid");
        }

        await new Promise(resolve => setTimeout(resolve, 150));
      }
    });
  });

  describe("testVerifySignatures", function () {
    it("should successfully verify valid signatures", async function () {
      this.timeout(60000);

      const testData = "0x123456789abcdef0";
      const guardianCount = 3;
      const params: GuardianSetParams = {
        privateKeys: generateValidPrivateKeys(guardianCount),
        guardianCount: guardianCount,
        expirationTime: Math.floor(Date.now() / 1000) + 3600
      };

      const message = ethers.utils.keccak256(testData);
      const guardianSet = generateGuardianSet(params);
      const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

      const result = await messages.verifySignatures(message, signatures, guardianSet);
      expect(result.valid).to.equal(true);
      expect(result.reason).to.equal("");
    });

    it("should handle fuzzing for various valid signature scenarios", async function () {
      this.timeout(120000);

      const testScenarios = [
        { guardianCount: 1, description: "single guardian" },
        { guardianCount: 3, description: "three guardians" },
        { guardianCount: 5, description: "five guardians" },
        { guardianCount: 7, description: "seven guardians" }
      ];

      for (const scenario of testScenarios) {
        const testData = ethers.utils.hexlify(ethers.utils.randomBytes(32));
        const params: GuardianSetParams = {
          privateKeys: generateValidPrivateKeys(scenario.guardianCount),
          guardianCount: scenario.guardianCount,
          expirationTime: Math.floor(Date.now() / 1000) + 3600
        };

        const message = ethers.utils.keccak256(testData);
        const guardianSet = generateGuardianSet(params);
        const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

        const result = await messages.verifySignatures(message, signatures, guardianSet);
        expect(result.valid).to.equal(true);
        expect(result.reason).to.equal("");

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });

    it("should verify signatures with different message lengths", async function () {
      this.timeout(60000);

      const messageLengths = [1, 8, 32, 64, 128];
      const guardianCount = 2;
      
      for (const length of messageLengths) {
        const testData = ethers.utils.hexlify(ethers.utils.randomBytes(length));
        const params: GuardianSetParams = {
          privateKeys: generateValidPrivateKeys(guardianCount),
          guardianCount: guardianCount,
          expirationTime: Math.floor(Date.now() / 1000) + 3600
        };

        const message = ethers.utils.keccak256(testData);
        const guardianSet = generateGuardianSet(params);
        const signatures = generateSignatures(params.privateKeys, guardianSet.keys, message);

        const result = await messages.verifySignatures(message, signatures, guardianSet);
        expect(result.valid).to.equal(true);
        expect(result.reason).to.equal("");

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });
});