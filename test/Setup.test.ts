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

  const testGuardian = "0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe";
  const governanceContract = "0x0000000000000000000000000000000000000000000000000000000000000004";

  before(async function () {
    this.timeout(60000);
    
    const signers = await ethers.getSigners();
    owner = signers[0];
    alice = signers[1] || signers[0];

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
    
    // Get current network chain ID for evmChainId
    const network = await ethers.provider.getNetwork();
    const evmChainId = network.chainId;
    
    // Perform setup through proxy (chainId=2, governanceChainId=1, evmChainId=current network)
    await proxiedSetup.setup(
      implementation.address,  // implementation
      keys,                   // initialGuardians  
      2,                      // chainId
      1,                      // governanceChainId
      governanceContract,     // governanceContract
      evmChainId              // evmChainId (current network chain ID)
    );

    // Get proxied interface as IWormhole
    const IWormholeFactory = await ethers.getContractFactory("Implementation", owner);
    proxied = IWormholeFactory.attach(proxy.address);
  });

  // Test equivalent to Foundry's testInitialize_after_setup_revert
  it("should revert initialize after setup from any address", async function () {
    // Test with alice (simulating fuzzing with different addresses)
    try {
      await proxied.connect(alice).initialize();
      throw new Error("Expected transaction to revert");
    } catch (error: any) {
      expect(error.message).to.include("already initialized");
    }

    // Test with owner (additional address)
    try {
      await proxied.connect(owner).initialize();
      throw new Error("Expected transaction to revert");
    } catch (error: any) {
      expect(error.message).to.include("already initialized");
    }
  });

  // Test equivalent to Foundry's testSetup_after_setup_revert
  it("should revert setup after setup with any parameters", async function () {
    // Get current network chain ID
    const network = await ethers.provider.getNetwork();
    const currentEvmChainId = network.chainId;
    
    // Test with different parameters (simulating Foundry's fuzzing)
    const testCases = [
      {
        implementation: implementation.address,
        guardian: testGuardian,
        chainId: 3,
        governanceChainId: 1,
        govContract: governanceContract,
        evmChainId: currentEvmChainId
      },
      {
        implementation: await alice.getAddress(), // different implementation
        guardian: await alice.getAddress(),       // different guardian
        chainId: 5,
        governanceChainId: 2,
        govContract: "0x0000000000000000000000000000000000000000000000000000000000000005",
        evmChainId: currentEvmChainId
      }
    ];

    for (const testCase of testCases) {
      const keys = [testCase.guardian];
      
      try {
        await proxiedSetup.connect(alice).setup(
          testCase.implementation,
          keys,
          testCase.chainId,
          testCase.governanceChainId,
          testCase.govContract,
          testCase.evmChainId
        );
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("unsupported");
      }
    }
  });

  // Basic state verification (minimal, focused on core functionality)
  it("should have correct state after setup", async function () {
    expect(await proxied.chainId()).to.equal(2);
    expect(await proxied.governanceChainId()).to.equal(1);
    expect(await proxied.governanceContract()).to.equal(governanceContract);
    
    const guardianSet = await proxied.getGuardianSet(0);
    const keys = guardianSet[0];
    expect(keys.length).to.equal(1);
    expect(keys[0].toLowerCase()).to.equal(testGuardian.toLowerCase());
  });

  // KEVM equivalent tests - simulating KEVM behavior in Hardhat
  describe("KEVM Equivalent Tests", function () {
    
    // Equivalent to testInitialize_after_setup_revert_KEVM
    it("should revert initialize after setup (KEVM simulation)", async function () {
      // Simulate KEVM environment by testing without gas constraints
      // KEVM tests ensure the revert happens regardless of gas availability
      
      try {
        await proxied.connect(alice).initialize();
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("already initialized");
      }

      // Test with owner as well (simulating Foundry's fuzzing with different addresses)
      try {
        await proxied.connect(owner).initialize();
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("already initialized");
      }
    });

    // Equivalent to testSetup_after_setup_revert_KEVM  
    it("should revert setup after setup (KEVM simulation)", async function () {
      // Simulate KEVM environment by testing with random parameters
      const network = await ethers.provider.getNetwork();
      const currentEvmChainId = network.chainId;
      
      const testCase = {
        implementation: implementation.address,
        guardian: testGuardian,
        chainId: 3,
        governanceChainId: 1,
        govContract: governanceContract,
        evmChainId: currentEvmChainId
      };

      const keys = [testCase.guardian];
      
      try {
        await proxiedSetup.connect(alice).setup(
          testCase.implementation,
          keys,
          testCase.chainId,
          testCase.governanceChainId,
          testCase.govContract,
          testCase.evmChainId
        );
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("unsupported");
      }
    });

    // Storage invariant testing (simulating unchangedStorage modifier)
    it("should maintain storage invariants during failed operations", async function () {
      // Capture initial state
      const initialChainId = await proxied.chainId();
      const initialGovChainId = await proxied.governanceChainId();
      const initialGovContract = await proxied.governanceContract();
      const initialGuardianSet = await proxied.getGuardianSet(0);
      
      // Test failed initialize
      try {
        await proxied.connect(alice).initialize();
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("already initialized");
      }
      
      // Verify storage unchanged after failed initialize
      expect(await proxied.chainId()).to.equal(initialChainId);
      expect(await proxied.governanceChainId()).to.equal(initialGovChainId);
      expect(await proxied.governanceContract()).to.equal(initialGovContract);
      
      const guardianSetAfterInit = await proxied.getGuardianSet(0);
      expect(guardianSetAfterInit[0].length).to.equal(initialGuardianSet[0].length);
      expect(guardianSetAfterInit[0][0]).to.equal(initialGuardianSet[0][0]);

      // Test failed setup
      const network = await ethers.provider.getNetwork();
      const currentEvmChainId = network.chainId;
      const keys = [testGuardian];
      
      try {
        await proxiedSetup.connect(alice).setup(
          implementation.address,
          keys,
          999, // different chainId
          1,
          governanceContract,
          currentEvmChainId
        );
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("unsupported");
      }
      
      // Verify storage still unchanged after failed setup
      expect(await proxied.chainId()).to.equal(initialChainId);
      expect(await proxied.governanceChainId()).to.equal(initialGovChainId);
      expect(await proxied.governanceContract()).to.equal(initialGovContract);
      
      const guardianSetAfterSetup = await proxied.getGuardianSet(0);
      expect(guardianSetAfterSetup[0].length).to.equal(initialGuardianSet[0].length);
      expect(guardianSetAfterSetup[0][0]).to.equal(initialGuardianSet[0][0]);
    });

  });

});