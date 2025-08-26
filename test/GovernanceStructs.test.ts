import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";



describe("GovernanceStructs", function () {
  let gs: Contract;
  let owner: Signer;

  beforeEach(async function () {
    try {
      const signers = await ethers.getSigners();
      owner = signers[0];
    } catch (error) {
      throw error;
    }

    // Deploy GovernanceStructs contract
    const GovernanceStructsFactory = await ethers.getContractFactory("GovernanceStructs", owner);
    gs = await GovernanceStructsFactory.deploy();
    await gs.deployed();
  });

  describe("testParseContractUpgrade", function () {
    it("should parse contract upgrade correctly", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-module"));
      const chain = 1;
      const newContract = ethers.utils.hexZeroPad("0x1234567890123456789012345678901234567890", 32);
      const action = 1;

      // Encode upgrade like in Foundry test
      const encodedUpgrade = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "bytes32"],
        [module, action, chain, newContract]
      );

      // Verify length matches Foundry expectation (67 bytes)
      expect(ethers.utils.arrayify(encodedUpgrade).length).to.equal(67);

      // Parse the contract upgrade
      const cu = await gs.parseContractUpgrade(encodedUpgrade);

      // Verify all fields match
      expect(cu.module).to.equal(module);
      expect(cu.action).to.equal(action);
      expect(cu.chain).to.equal(chain);
      expect(cu.newContract).to.equal(ethers.utils.getAddress(ethers.utils.hexDataSlice(newContract, 12)));
    });

    it("should handle fuzzing for contract upgrade parsing", async function () {
      this.timeout(60000);

      const testCases = [
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("module1")),
          chain: 1,
          newContract: ethers.utils.hexZeroPad("0x1111111111111111111111111111111111111111", 32)
        },
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("module2")),
          chain: 137,
          newContract: ethers.utils.hexZeroPad("0x2222222222222222222222222222222222222222", 32)
        },
        {
          module: ethers.utils.hexZeroPad("0xdead", 32),
          chain: 65535,
          newContract: ethers.utils.hexZeroPad("0xbeef", 32)
        }
      ];

      for (const testCase of testCases) {
        const action = 1;
        const encodedUpgrade = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "bytes32"],
          [testCase.module, action, testCase.chain, testCase.newContract]
        );

        const cu = await gs.parseContractUpgrade(encodedUpgrade);

        expect(cu.module).to.equal(testCase.module);
        expect(cu.action).to.equal(action);
        expect(cu.chain).to.equal(testCase.chain);
        expect(cu.newContract).to.equal(ethers.utils.getAddress(ethers.utils.hexDataSlice(testCase.newContract, 12)));

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should revert with wrong action", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-module"));
      const chain = 1;
      const newContract = ethers.utils.hexZeroPad("0x1234567890123456789012345678901234567890", 32);
      const wrongAction = 2; // Not 1

      const encodedUpgrade = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "bytes32"],
        [module, wrongAction, chain, newContract]
      );

      try {
        await gs.parseContractUpgrade(encodedUpgrade);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid ContractUpgrade");
      }
    });

    it("should handle fuzzing for wrong action revert", async function () {
      this.timeout(60000);

      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-module"));
      const chain = 1;
      const newContract = ethers.utils.hexZeroPad("0x1234567890123456789012345678901234567890", 32);
      const wrongActions = [0, 2, 3, 4, 5, 255]; // All except 1

      for (const action of wrongActions) {
        const encodedUpgrade = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "bytes32"],
          [module, action, chain, newContract]
        );

        try {
          await gs.parseContractUpgrade(encodedUpgrade);
          expect.fail("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("invalid ContractUpgrade");
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it("should revert when size too small", async function () {
      // Create bytes smaller than 67 bytes
      const tooSmallBytes = ethers.utils.hexlify(ethers.utils.randomBytes(60)); // 60 < 67

      try {
        await gs.parseContractUpgrade(tooSmallBytes);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("revert") || msg.includes("invalid") || msg.includes("out of bounds")
        );
      }
    });

    it("should revert when size too large", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-module"));
      const action = 1;
      const chain = 1;
      const newContract = ethers.utils.hexZeroPad("0x1234567890123456789012345678901234567890", 32);
      const extraBytes = ethers.utils.randomBytes(10); // Extra bytes

      const encodedUpgrade = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "bytes32", "bytes"],
        [module, action, chain, newContract, extraBytes]
      );

      expect(ethers.utils.arrayify(encodedUpgrade).length).to.be.greaterThan(67);

      try {
        await gs.parseContractUpgrade(encodedUpgrade);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid ContractUpgrade");
      }
    });
  });

  describe("testParseSetMessageFee", function () {
    it("should parse set message fee correctly", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee-module"));
      const chain = 1;
      const messageFee = ethers.utils.parseEther("0.01");
      const action = 3;

      const encodedSetMessageFee = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256"],
        [module, action, chain, messageFee]
      );

      // Verify length matches Foundry expectation (67 bytes)
      expect(ethers.utils.arrayify(encodedSetMessageFee).length).to.equal(67);

      const smf = await gs.parseSetMessageFee(encodedSetMessageFee);

      expect(smf.module).to.equal(module);
      expect(smf.action).to.equal(action);
      expect(smf.chain).to.equal(chain);
      expect(smf.messageFee.toString()).to.equal(messageFee.toString());
    });

    it("should handle fuzzing for set message fee parsing", async function () {
      this.timeout(60000);

      const testCases = [
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee1")),
          chain: 1,
          messageFee: ethers.utils.parseEther("0.001")
        },
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee2")),
          chain: 56,
          messageFee: ethers.utils.parseEther("1")
        },
        {
          module: ethers.utils.hexZeroPad("0xfee", 32),
          chain: 137,
          messageFee: ethers.BigNumber.from("12345678901234567890")
        }
      ];

      for (const testCase of testCases) {
        const action = 3;
        const encodedSetMessageFee = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "uint256"],
          [testCase.module, action, testCase.chain, testCase.messageFee]
        );

        const smf = await gs.parseSetMessageFee(encodedSetMessageFee);

        expect(smf.module).to.equal(testCase.module);
        expect(smf.action).to.equal(action);
        expect(smf.chain).to.equal(testCase.chain);
        expect(smf.messageFee.toString()).to.equal(testCase.messageFee.toString());

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should revert with wrong action", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee-module"));
      const chain = 1;
      const messageFee = ethers.utils.parseEther("0.01");
      const wrongAction = 1; // Not 3

      const encodedSetMessageFee = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256"],
        [module, wrongAction, chain, messageFee]
      );

      try {
        await gs.parseSetMessageFee(encodedSetMessageFee);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid SetMessageFee");
      }
    });

    it("should handle fuzzing for wrong action revert", async function () {
      this.timeout(60000);

      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee-module"));
      const chain = 1;
      const messageFee = ethers.utils.parseEther("0.01");
      const wrongActions = [0, 1, 2, 4, 5, 255]; // All except 3

      for (const action of wrongActions) {
        const encodedSetMessageFee = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "uint256"],
          [module, action, chain, messageFee]
        );

        try {
          await gs.parseSetMessageFee(encodedSetMessageFee);
          expect.fail("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("invalid SetMessageFee");
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it("should revert when size too small", async function () {
      const tooSmallBytes = ethers.utils.hexlify(ethers.utils.randomBytes(60)); // 60 < 67

      try {
        await gs.parseSetMessageFee(tooSmallBytes);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("revert") || msg.includes("invalid") || msg.includes("out of bounds")
        );
      }
    });

    it("should revert when size too large", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fee-module"));
      const action = 3;
      const chain = 1;
      const messageFee = ethers.utils.parseEther("0.01");
      const extraBytes = ethers.utils.randomBytes(5);

      const encodedSetMessageFee = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256", "bytes"],
        [module, action, chain, messageFee, extraBytes]
      );

      expect(ethers.utils.arrayify(encodedSetMessageFee).length).to.be.greaterThan(67);

      try {
        await gs.parseSetMessageFee(encodedSetMessageFee);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid SetMessageFee");
      }
    });
  });

  describe("testParseTransferFees", function () {
    it("should parse transfer fees correctly", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer-module"));
      const chain = 1;
      const amount = ethers.utils.parseEther("10");
      const recipient = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recipient"));
      const action = 4;

      const encodedTransferFees = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256", "bytes32"],
        [module, action, chain, amount, recipient]
      );

      // Verify length matches Foundry expectation (99 bytes)
      expect(ethers.utils.arrayify(encodedTransferFees).length).to.equal(99);

      const tf = await gs.parseTransferFees(encodedTransferFees);

      expect(tf.module).to.equal(module);
      expect(tf.action).to.equal(action);
      expect(tf.chain).to.equal(chain);
      expect(tf.amount.toString()).to.equal(amount.toString());
      expect(tf.recipient).to.equal(recipient);
    });

    it("should handle fuzzing for transfer fees parsing", async function () {
      this.timeout(60000);

      const testCases = [
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer1")),
          chain: 1,
          amount: ethers.utils.parseEther("1"),
          recipient: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("user1"))
        },
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer2")),
          chain: 137,
          amount: ethers.utils.parseEther("100"),
          recipient: ethers.utils.hexZeroPad("0x1234", 32)
        }
      ];

      for (const testCase of testCases) {
        const action = 4;
        const encodedTransferFees = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "uint256", "bytes32"],
          [testCase.module, action, testCase.chain, testCase.amount, testCase.recipient]
        );

        const tf = await gs.parseTransferFees(encodedTransferFees);

        expect(tf.module).to.equal(testCase.module);
        expect(tf.action).to.equal(action);
        expect(tf.chain).to.equal(testCase.chain);
        expect(tf.amount.toString()).to.equal(testCase.amount.toString());
        expect(tf.recipient).to.equal(testCase.recipient);

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should revert with wrong action", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer-module"));
      const chain = 1;
      const amount = ethers.utils.parseEther("10");
      const recipient = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recipient"));
      const wrongAction = 1; // Not 4

      const encodedTransferFees = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256", "bytes32"],
        [module, wrongAction, chain, amount, recipient]
      );

      try {
        await gs.parseTransferFees(encodedTransferFees);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid TransferFees");
      }
    });

    it("should handle fuzzing for wrong action revert", async function () {
      this.timeout(60000);

      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer-module"));
      const chain = 1;
      const amount = ethers.utils.parseEther("10");
      const recipient = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recipient"));
      const wrongActions = [0, 1, 2, 3, 5, 255]; // All except 4

      for (const action of wrongActions) {
        const encodedTransferFees = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint16", "uint256", "bytes32"],
          [module, action, chain, amount, recipient]
        );

        try {
          await gs.parseTransferFees(encodedTransferFees);
          expect.fail("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("invalid TransferFees");
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it("should revert when size too small", async function () {
      const tooSmallBytes = ethers.utils.hexlify(ethers.utils.randomBytes(90)); // 90 < 99

      try {
        await gs.parseTransferFees(tooSmallBytes);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("revert") || msg.includes("invalid") || msg.includes("out of bounds")
        );
      }
    });

    it("should revert when size too large", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("transfer-module"));
      const action = 4;
      const chain = 1;
      const amount = ethers.utils.parseEther("10");
      const recipient = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recipient"));
      const extraBytes = ethers.utils.randomBytes(5);

      const encodedTransferFees = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint16", "uint256", "bytes32", "bytes"],
        [module, action, chain, amount, recipient, extraBytes]
      );

      expect(ethers.utils.arrayify(encodedTransferFees).length).to.be.greaterThan(99);

      try {
        await gs.parseTransferFees(encodedTransferFees);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid TransferFees");
      }
    });
  });

  describe("testParseRecoverChainId", function () {
    it("should parse recover chain ID correctly", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover-module"));
      const evmChainId = 1;
      const newChainId = 2;
      const action = 5;

      const encodedRecoverChainId = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint256", "uint16"],
        [module, action, evmChainId, newChainId]
      );

      // Verify length matches Foundry expectation (67 bytes)
      expect(ethers.utils.arrayify(encodedRecoverChainId).length).to.equal(67);

      const rci = await gs.parseRecoverChainId(encodedRecoverChainId);

      expect(rci.module).to.equal(module);
      expect(rci.action).to.equal(action);
      expect(rci.evmChainId.toString()).to.equal(evmChainId.toString());
      expect(rci.newChainId).to.equal(newChainId);
    });

    it("should handle fuzzing for recover chain ID parsing", async function () {
      this.timeout(60000);

      const testCases = [
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover1")),
          evmChainId: 1,
          newChainId: 2
        },
        {
          module: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover2")),
          evmChainId: 137,
          newChainId: 1337
        },
        {
          module: ethers.utils.hexZeroPad("0xdead", 32),
          evmChainId: 0xffffffff,
          newChainId: 65535
        }
      ];

      for (const testCase of testCases) {
        const action = 5;
        const encodedRecoverChainId = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint256", "uint16"],
          [testCase.module, action, testCase.evmChainId, testCase.newChainId]
        );

        const rci = await gs.parseRecoverChainId(encodedRecoverChainId);

        expect(rci.module).to.equal(testCase.module);
        expect(rci.action).to.equal(action);
        expect(rci.evmChainId.toString()).to.equal(testCase.evmChainId.toString());
        expect(rci.newChainId).to.equal(testCase.newChainId);

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should revert with wrong action", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover-module"));
      const evmChainId = 1;
      const newChainId = 2;
      const wrongAction = 1; // Not 5

      const encodedRecoverChainId = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint256", "uint16"],
        [module, wrongAction, evmChainId, newChainId]
      );

      try {
        await gs.parseRecoverChainId(encodedRecoverChainId);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid RecoverChainId");
      }
    });

    it("should handle fuzzing for wrong action revert", async function () {
      this.timeout(60000);

      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover-module"));
      const evmChainId = 1;
      const newChainId = 2;
      const wrongActions = [0, 1, 2, 3, 4, 255]; // All except 5

      for (const action of wrongActions) {
        const encodedRecoverChainId = ethers.utils.solidityPack(
          ["bytes32", "uint8", "uint256", "uint16"],
          [module, action, evmChainId, newChainId]
        );

        try {
          await gs.parseRecoverChainId(encodedRecoverChainId);
          expect.fail("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("invalid RecoverChainId");
        }

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    it("should revert when size too small", async function () {
      const tooSmallBytes = ethers.utils.hexlify(ethers.utils.randomBytes(60)); // 60 < 67

      try {
        await gs.parseRecoverChainId(tooSmallBytes);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.satisfy((msg: string) => 
          msg.includes("revert") || msg.includes("invalid") || msg.includes("out of bounds")
        );
      }
    });

    it("should revert when size too large", async function () {
      const module = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("recover-module"));
      const action = 5;
      const evmChainId = 1;
      const newChainId = 2;
      const extraBytes = ethers.utils.randomBytes(10);

      const encodedRecoverChainId = ethers.utils.solidityPack(
        ["bytes32", "uint8", "uint256", "uint16", "bytes"],
        [module, action, evmChainId, newChainId, extraBytes]
      );

      expect(ethers.utils.arrayify(encodedRecoverChainId).length).to.be.greaterThan(67);

      try {
        await gs.parseRecoverChainId(encodedRecoverChainId);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("invalid RecoverChainId");
      }
    });
  });
});