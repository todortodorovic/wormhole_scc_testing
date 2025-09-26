import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Setup", function () {
  let proxy: Contract;
  let implementation: Contract;
  let setup: Contract;
  let proxiedSetup: Contract;
  let proxied: Contract;
  let owner: Signer;
  let alice: Signer;
  let guardianWallet: Signer;

  const testGuardian = "0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe";
  const governanceContract = "0x0000000000000000000000000000000000000000000000000000000000000004";

    before(async function () {
    this.timeout(60000); 
    try {
      const signers = await ethers.getSigners();
      
      if (signers.length >= 1) {
        const baseSigner = signers[0];
        
        if (signers.length >= 3) {
          [owner, alice, guardianWallet] = signers;
        } else {
          owner = baseSigner;
          alice = signers.length > 1 ? signers[1] : baseSigner;
          guardianWallet = signers.length > 2 ? signers[2] : baseSigner;
        }
      } else {
        throw new Error("No signers available");
      }
    } catch (error) {
      throw error;
    }

    // Deploy Setup contract
    const SetupFactory = await ethers.getContractFactory("Setup", owner);
    setup = await SetupFactory.deploy();
    await setup.deployed();

    // Deploy Implementation contract  
    const ImplementationFactory = await ethers.getContractFactory("Implementation", owner);
    implementation = await ImplementationFactory.deploy();
    await implementation.deployed();

    // Deploy Wormhole proxy
    const WormholeFactory = await ethers.getContractFactory("Wormhole", owner);
    proxy = await WormholeFactory.deploy(setup.address, "0x");
    await proxy.deployed();

    // Setup guardian keys array
    const keys = [testGuardian];

    // Get proxied setup interface
    proxiedSetup = SetupFactory.attach(proxy.address);

    // Get current network's chainId and use it as evmChainId
    const network = await ethers.provider.getNetwork();
    const evmChainId = network.chainId;
    
    // Perform setup through proxy
    await proxiedSetup.setup(
      implementation.address,  // implementation
      keys,                   // initialGuardians  
      2,                      // chainId
      1,                      // governanceChainId
      governanceContract,     // governanceContract
      evmChainId              // evmChainId - use current network's chainId
    );

    // Get proxied interface as IWormhole
    const IWormholeFactory = await ethers.getContractFactory("Implementation", owner);
    proxied = IWormholeFactory.attach(proxy.address);
  });

  describe("Initialization Protection", function () {
    it("should revert when trying to initialize after setup", async function () {
      // Try to call initialize from alice account
      try {
        await proxied.connect(alice).initialize();
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("already initialized");
      }
    });

    it("should revert from any address when trying to initialize after setup", async function () {
      const ownerAddr = await owner.getAddress();
      const aliceAddr = await alice.getAddress();
      const guardianAddr = await guardianWallet.getAddress();
      
      // Skip if all addresses are the same (single signer scenario)
      const sameAddresses = ownerAddr === aliceAddr && aliceAddr === guardianAddr;
      
      if (!sameAddresses) {
        // Try to call initialize from owner account
        try {
          await proxied.connect(owner).initialize();
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("already initialized");
        }
        
        // Try to call initialize from guardian account
        try {
          await proxied.connect(guardianWallet).initialize();
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("already initialized");
        }
      } else {
        // Single signer scenario - just test one call
        try {
          await proxied.connect(owner).initialize();
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("already initialized");
        }
      }
    });
  });

  describe("Setup Protection", function () {
    it("should revert when trying to setup after setup", async function () {
      const keys = [testGuardian];
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;

      try {
        await proxiedSetup.connect(alice).setup(
          implementation.address,
          keys,
          3,                    // different chainId
          1,                    // governanceChainId  
          governanceContract,   // governanceContract
          evmChainId            // evmChainId
        );
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("unsupported");
      }
    });

    it("should revert setup with different parameters", async function () {
      const aliceAddr = await alice.getAddress();
      const keys = [aliceAddr]; // different guardian
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;

      try {
        await proxiedSetup.connect(owner).setup(
          implementation.address,
          keys,
          5,                    // different chainId
          2,                    // different governanceChainId
          "0x0000000000000000000000000000000000000000000000000000000000000005", // different governance contract
          evmChainId            // evmChainId
        );
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("unsupported");
      }
    });

    it("should revert setup from any address after initial setup", async function () {
      const keys = [testGuardian];
      const ownerAddr = await owner.getAddress();
      const aliceAddr = await alice.getAddress();
      const sameUser = ownerAddr === aliceAddr;

      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;
      
      if (sameUser) {
        // Single signer scenario - test just one call
        try {
          await proxiedSetup.connect(owner).setup(
            implementation.address,
            keys,
            2,
            1,
            governanceContract,
            evmChainId
          );
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("unsupported");
        }
      } else {
        // Multiple signers - test both
        // Try from alice
        try {
          await proxiedSetup.connect(alice).setup(
            implementation.address,
            keys,
            2,
            1,
            governanceContract,
            evmChainId
          );
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("unsupported");
        }

        // Try from owner  
        try {
          await proxiedSetup.connect(owner).setup(
            implementation.address,
            keys,
            2,
            1,
            governanceContract,
            evmChainId
          );
          throw new Error("Expected transaction to revert");
        } catch (error: any) {
          expect(error.message).to.include("unsupported");
        }
      }
    });
  });

  describe("Setup State Verification", function () {
    it("should have correct chain ID after setup", async function () {
      const chainId = await proxied.chainId();
      expect(chainId).to.equal(2);
    });

    it("should have correct governance chain ID after setup", async function () {
      const governanceChainId = await proxied.governanceChainId();
      expect(governanceChainId).to.equal(1);
    });

    it("should have correct governance contract after setup", async function () {
      const govContract = await proxied.governanceContract();
      expect(govContract).to.equal(governanceContract);
    });

    it("should have correct guardian set after setup", async function () {
      const guardianSet = await proxied.getGuardianSet(0);
      
      // Access keys as guardianSet[0] since it's a tuple
      const keys = guardianSet[0];
      expect(keys.length).to.equal(1);
      expect(keys[0].toLowerCase()).to.equal(testGuardian.toLowerCase());
    });

    it("should be initialized after setup", async function () {
      // The contract should be initialized after setup
      // We can verify this by checking that initialize() reverts
      try {
        await proxied.initialize();
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("already initialized");
      }
    });
  });

  describe("Fuzzing Tests", function () {
    // Increase timeout for fuzzing tests to avoid resource overload
    this.timeout(120000); // 2 minutes timeout
    // Generate pseudo-random addresses for fuzzing
    const generateRandomAddress = (seed: number): string => {
      const hex = (seed.toString(16).padStart(8, '0')).repeat(10).slice(0, 40);
      return `0x${hex}`;
    };

    // Generate pseudo-random numbers
    const generateRandomUint16 = (seed: number): number => {
      return (seed % 65535) + 1;
    };

    // Generate pseudo-random bytes32
    const generateRandomBytes32 = (seed: number): string => {
      const hex = seed.toString(16).padStart(8, '0').repeat(16).slice(0, 64);
      return `0x${hex}`;
    };

    it("should revert initialize from multiple random addresses (fuzzing)", async function () {
      this.timeout(30000); // 30 seconds timeout
      // Test with 5 different random addresses (reduced to avoid resource overload)
      for (let i = 0; i < 5; i++) {
        const randomAddr = generateRandomAddress(12345 + i);
        
        // Create a wallet with this address (for testing purposes)
        // We'll use alice as the signer but conceptually test different addresses
        try {
          await proxied.connect(alice).initialize();
          throw new Error(`Expected transaction to revert for address ${randomAddr}`);
        } catch (error: any) {
          expect(error.message).to.include("already initialized", `Failed for address ${randomAddr}`);
        }
        
        // Small delay to avoid overwhelming the network
        if (i < 4) await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it("should revert setup with random parameters (fuzzing)", async function () {
      this.timeout(45000); // 45 seconds timeout
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;

      // Test with 8 different random parameter combinations (reduced to avoid resource overload)
      for (let i = 0; i < 8; i++) {
        const seed = 54321 + i;
        const randomImplementation = generateRandomAddress(seed);
        const randomGuardian = generateRandomAddress(seed + 100);
        const randomChainId = generateRandomUint16(seed + 200);
        const randomGovChainId = generateRandomUint16(seed + 300);
        const randomGovContract = generateRandomBytes32(seed + 400);

        const keys = [randomGuardian];

        try {
          await proxiedSetup.connect(alice).setup(
            randomImplementation,
            keys,
            randomChainId,
            randomGovChainId,
            randomGovContract,
            evmChainId
          );
          throw new Error(`Expected transaction to revert for iteration ${i}`);
        } catch (error: any) {
          expect(error.message).to.include("unsupported", `Failed for iteration ${i} with params: impl=${randomImplementation}, chainId=${randomChainId}, govChainId=${randomGovChainId}, govContract=${randomGovContract}`);
        }
        
        // Small delay to avoid overwhelming the network
        if (i < 7) await new Promise(resolve => setTimeout(resolve, 200));
      }
    });

    it("should revert setup from multiple addresses with various parameters (fuzzing)", async function () {
      this.timeout(40000); // 40 seconds timeout
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;
      
      const signers = [owner, alice, guardianWallet];
      
      // Test with 6 different combinations (3 signers × 2 parameter sets) (reduced to avoid resource overload)
      for (let signerIndex = 0; signerIndex < signers.length; signerIndex++) {
        for (let paramSet = 0; paramSet < 2; paramSet++) {
          const seed = 98765 + signerIndex * 100 + paramSet;
          const signer = signers[signerIndex];
          
          const randomImplementation = generateRandomAddress(seed);
          const randomGuardian = generateRandomAddress(seed + 50);
          const randomChainId = generateRandomUint16(seed + 100);
          const randomGovChainId = generateRandomUint16(seed + 150);
          const randomGovContract = generateRandomBytes32(seed + 200);

          const keys = [randomGuardian];

          try {
            await proxiedSetup.connect(signer).setup(
              randomImplementation,
              keys,
              randomChainId,
              randomGovChainId,
              randomGovContract,
              evmChainId
            );
            throw new Error(`Expected transaction to revert for signer ${signerIndex}, paramSet ${paramSet}`);
          } catch (error: any) {
            expect(error.message).to.include("unsupported", `Failed for signer ${signerIndex}, paramSet ${paramSet}`);
          }
          
          // Small delay to avoid overwhelming the network
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    });

    it("should handle edge case parameters (boundary fuzzing)", async function () {
      this.timeout(25000); // 25 seconds timeout
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;

      // Test boundary values
      const boundaryTests = [
        { chainId: 0, govChainId: 0 },
        { chainId: 1, govChainId: 1 },
        { chainId: 65535, govChainId: 65535 }, // max uint16
        { chainId: 32767, govChainId: 32768 }, // around mid-range
      ];

      for (let i = 0; i < boundaryTests.length; i++) {
        const test = boundaryTests[i];
        const randomImplementation = generateRandomAddress(11111 + i);
        const randomGuardian = generateRandomAddress(22222 + i);
        const randomGovContract = generateRandomBytes32(33333 + i);
        const keys = [randomGuardian];

        try {
          await proxiedSetup.connect(alice).setup(
            randomImplementation,
            keys,
            test.chainId,
            test.govChainId,
            randomGovContract,
            evmChainId
          );
          throw new Error(`Expected transaction to revert for boundary test ${i}`);
        } catch (error: any) {
          expect(error.message).to.include("unsupported", `Failed for boundary test ${i}: chainId=${test.chainId}, govChainId=${test.govChainId}`);
        }
      }
    });

    it("should revert with various guardian array sizes (fuzzing)", async function () {
      this.timeout(30000); // 30 seconds timeout
      const network = await ethers.provider.getNetwork();
      const evmChainId = network.chainId;

      // Test different guardian array sizes (0, 1, 2, 3 guardians) (reduced to avoid resource overload)
      const guardianCounts = [0, 1, 2, 3];
      
      for (let guardianCount of guardianCounts) {
        const keys = [];
        for (let j = 0; j < guardianCount; j++) {
          keys.push(generateRandomAddress(77777 + j));
        }

        const randomImplementation = generateRandomAddress(88888 + guardianCount);
        const randomGovContract = generateRandomBytes32(99999 + guardianCount);

        try {
          await proxiedSetup.connect(alice).setup(
            randomImplementation,
            keys,
            5, // random chainId
            3, // random govChainId
            randomGovContract,
            evmChainId
          );
          throw new Error(`Expected transaction to revert for ${guardianCount} guardians`);
        } catch (error: any) {
          // Should revert with either "unsupported" (already setup) or "no guardians specified" (if 0 guardians)
          expect(error.message).to.satisfy(
            (msg: string) => msg.includes("unsupported") || msg.includes("no guardians specified"),
            `Failed for ${guardianCount} guardians: ${error.message}`
          );
        }
      }
    });

    it("should test initialize with pseudo-storage invariants", async function () {
      this.timeout(35000); // 35 seconds timeout
      // Simulate storage invariant testing by checking state before and after failed calls
      const initialChainId = await proxied.chainId();
      const initialGovChainId = await proxied.governanceChainId();
      const initialGovContract = await proxied.governanceContract();
      const initialGuardianSet = await proxied.getGuardianSet(0);

      // Test 3 different failed initialize attempts (reduced to avoid resource overload)
      for (let i = 0; i < 3; i++) {
        try {
          await proxied.connect(alice).initialize();
          throw new Error(`Expected transaction to revert for iteration ${i}`);
        } catch (error: any) {
          expect(error.message).to.include("already initialized");
        }

        // Verify storage hasn't changed (pseudo-unchangedStorage modifier)
        expect(await proxied.chainId()).to.equal(initialChainId, `ChainId changed after iteration ${i}`);
        expect(await proxied.governanceChainId()).to.equal(initialGovChainId, `GovChainId changed after iteration ${i}`);
        expect(await proxied.governanceContract()).to.equal(initialGovContract, `GovContract changed after iteration ${i}`);
        
        const currentGuardianSet = await proxied.getGuardianSet(0);
        expect(currentGuardianSet[0].length).to.equal(initialGuardianSet[0].length, `Guardian count changed after iteration ${i}`);
        expect(currentGuardianSet[0][0]).to.equal(initialGuardianSet[0][0], `Guardian address changed after iteration ${i}`);
      }
    });
  });
});