import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";


describe("Token Migrator", function () {
  let fromToken: Contract;
  let toToken: Contract;
  let migrator: Contract;
  let owner: Signer;
  let user1: Signer;

  const fromDecimals = 8;
  const toDecimals = 18;

  beforeEach(async function () {
    this.timeout(60000); 
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1] || signers[0];

    try {
      // Deploy REAL TokenImplementation contracts
      const TokenImplementationFactory = await ethers.getContractFactory("TokenImplementation", owner);
      
      // Deploy fromToken (8 decimals)
      fromToken = await TokenImplementationFactory.deploy();
      await fromToken.deployed();
      await fromToken.initialize(
        "TestFrom",
        "FROM",
        fromDecimals,
        0,
        await owner.getAddress(),
        0,
        ethers.constants.HashZero
      );

      // Deploy toToken (18 decimals)
      toToken = await TokenImplementationFactory.deploy();
      await toToken.deployed();
      await toToken.initialize(
        "TestTo",
        "TO",
        toDecimals,
        0,
        await owner.getAddress(),
        0,
        ethers.constants.HashZero
      );

      // Deploy REAL Migrator contract
      const MigratorFactory = await ethers.getContractFactory("Migrator", owner);
      migrator = await MigratorFactory.deploy(fromToken.address, toToken.address);
      await migrator.deployed();

      // Verify setup
      expect(await migrator.fromAsset()).to.equal(fromToken.address);
      expect(await migrator.toAsset()).to.equal(toToken.address);
      expect((await migrator.fromDecimals()).toNumber()).to.equal(fromDecimals);
      expect((await migrator.toDecimals()).toNumber()).to.equal(toDecimals);

    } catch (error) {
      console.log("Real contract deployment error:", error);
      throw error; // Fail fast if real contracts can't be deployed
    }
  });

  // Helper function to mint tokens for testing
  async function setupTestTokens() {
    // Mint some initial tokens for testing
    const initialAmount = ethers.utils.parseUnits("10000", toDecimals);
    await toToken.mint(await owner.getAddress(), initialAmount);
    
    const fromAmount = ethers.utils.parseUnits("10000", fromDecimals);
    await fromToken.mint(await user1.getAddress(), fromAmount);
  }

  // Group 1: LP Token Operations (2 tests)
  it("should give out LP tokens 1:1 for a TO token deposit", async function () {
    const amount = ethers.utils.parseUnits("1", toDecimals);
    
    // Verify migrator setup
    const fromAsset = await migrator.fromAsset();
    const toAsset = await migrator.toAsset();
    const fromDec = await migrator.fromDecimals();
    const toDec = await migrator.toDecimals();
    
    expect(fromAsset).to.equal(fromToken.address);
    expect(toAsset).to.equal(toToken.address);
    expect(fromDec.toNumber()).to.equal(fromDecimals);
    expect(toDec.toNumber()).to.equal(toDecimals);
    
    // Mint tokens to owner
    await toToken.mint(await owner.getAddress(), amount);
    
    // Approve migrator to spend tokens
    await toToken.approve(migrator.address, amount);
    
    // Add tokens to migrator (should get LP tokens 1:1)
    await migrator.add(amount);
    
    // Verify LP tokens received
    const lpBalance = await migrator.balanceOf(await owner.getAddress());
    expect(lpBalance.eq(amount)).to.be.true;
    
    // Verify toToken is in migrator
    const migratorToBalance = await toToken.balanceOf(migrator.address);
    expect(migratorToBalance.eq(amount)).to.be.true;
  });

  it("should refund TO token for LP tokens", async function () {
    const depositAmount = ethers.utils.parseUnits("1", toDecimals);
    const withdrawAmount = ethers.utils.parseUnits("0.5", toDecimals);
    
    // First add tokens (simulate previous test)
    await toToken.mint(await owner.getAddress(), depositAmount);
    await toToken.approve(migrator.address, depositAmount);
    await migrator.add(depositAmount);
    
    // Now remove half of the LP tokens
    await migrator.remove(withdrawAmount);
    
    // Verify remaining LP balance
    const remainingLpBalance = await migrator.balanceOf(await owner.getAddress());
    expect(remainingLpBalance.eq(withdrawAmount)).to.be.true;
    
    // Verify migrator still has half the toTokens
    const remainingMigratorBalance = await toToken.balanceOf(migrator.address);
    expect(remainingMigratorBalance.eq(withdrawAmount)).to.be.true;
    
    // Verify owner got back toTokens
    const ownerToBalance = await toToken.balanceOf(await owner.getAddress());
    expect(ownerToBalance.eq(withdrawAmount)).to.be.true;
  });

  // Group 2: Migration & Decimal Adjustment (2 tests)
  it("should redeem FROM token to TO token adjusting for decimals", async function () {
    // Setup initial state - need enough tokens for LP operations
    const lpAmount = ethers.utils.parseUnits("1", toDecimals); // Increased amount
    await toToken.mint(await owner.getAddress(), lpAmount);
    await toToken.approve(migrator.address, lpAmount);
    await migrator.add(lpAmount);
    // Don't remove tokens - keep them in migrator for user to get when migrating
    
    // Setup user with fromTokens (8 decimals)
    const userAddress = await user1.getAddress();
    const fromAmount = ethers.utils.parseUnits("0.5", fromDecimals); // 50000000 (8 decimals)
    
    await fromToken.mint(userAddress, fromAmount);
    await fromToken.connect(user1).approve(migrator.address, fromAmount);
    
    // Migrate fromToken to toToken (should adjust decimals 8->18)
    await migrator.connect(user1).migrate(fromAmount);
    
    // Expected toToken amount (decimal adjustment: 50000000 * 10^10 = 500000000000000000)
    const expectedToAmount = ethers.utils.parseUnits("0.5", toDecimals);
    
    // Verify user received adjusted toTokens
    const userToBalance = await toToken.balanceOf(userAddress);
    expect(userToBalance.eq(expectedToAmount)).to.be.true;
    
    // Verify user has no fromTokens (all migrated)
    const userFromBalance = await fromToken.balanceOf(userAddress);
    expect(userFromBalance.eq(0)).to.be.true;
    
    // Verify migrator received the fromTokens
    const migratorFromBalance = await fromToken.balanceOf(migrator.address);
    expect(migratorFromBalance.eq(fromAmount)).to.be.true;
  });

  it("should make FROM token claimable for LP tokens adjusting for decimals", async function () {
    // Setup state - provide initial LP tokens
    const lpAmount = ethers.utils.parseUnits("1", toDecimals); // Enough for operations
    await toToken.mint(await owner.getAddress(), lpAmount);
    await toToken.approve(migrator.address, lpAmount);  
    await migrator.add(lpAmount);
    // Keep LP tokens for claiming later
    
    // User migration
    const userAddress = await user1.getAddress(); 
    const fromAmount = ethers.utils.parseUnits("0.5", fromDecimals);
    await fromToken.mint(userAddress, fromAmount);
    await fromToken.connect(user1).approve(migrator.address, fromAmount);
    await migrator.connect(user1).migrate(fromAmount);
    
    // Now LP holder can claim the fromTokens
    const claimAmount = ethers.utils.parseUnits("0.5", toDecimals); // LP tokens to claim
    await migrator.claim(claimAmount);
    
    // Expected fromToken amount for LP holder (decimal adjustment: 500000000000000000 / 10^10 = 50000000)
    const expectedFromAmount = ethers.utils.parseUnits("0.5", fromDecimals);
    
    // Verify LP holder received fromTokens
    const ownerFromBalance = await fromToken.balanceOf(await owner.getAddress());
    expect(ownerFromBalance.eq(expectedFromAmount)).to.be.true;
    
    // Verify LP holder claimed some LP tokens
    const ownerLpBalance = await migrator.balanceOf(await owner.getAddress());
    const remainingLP = lpAmount.sub(claimAmount);
    expect(ownerLpBalance.eq(remainingLP)).to.be.true;
  });

  it("should handle complete migration flow with fuzzing", async function () {
    this.timeout(60000); 

    const scenarios = [
      { depositAmount: "1", fromAmount: "0.1", description: "small amounts" },
      { depositAmount: "10", fromAmount: "1", description: "medium amounts" }
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      
      // Deploy fresh contracts for each scenario to avoid state interference
      const TokenImplementationFactory = await ethers.getContractFactory("TokenImplementation", owner);
      
      const freshFromToken = await TokenImplementationFactory.deploy();
      await freshFromToken.deployed();
      await freshFromToken.initialize("TestFrom", "FROM", fromDecimals, 0, await owner.getAddress(), 0, ethers.constants.HashZero);

      const freshToToken = await TokenImplementationFactory.deploy();
      await freshToToken.deployed();
      await freshToToken.initialize("TestTo", "TO", toDecimals, 0, await owner.getAddress(), 0, ethers.constants.HashZero);

      const MigratorFactory = await ethers.getContractFactory("Migrator", owner);
      const freshMigrator = await MigratorFactory.deploy(freshFromToken.address, freshToToken.address);
      await freshMigrator.deployed();
      
      const depositAmount = ethers.utils.parseUnits(scenario.depositAmount, toDecimals);
      const fromMigrateAmount = ethers.utils.parseUnits(scenario.fromAmount, fromDecimals);
      
      // Test complete flow
      await freshToToken.mint(await owner.getAddress(), depositAmount);
      await freshToToken.approve(freshMigrator.address, depositAmount);
      await freshMigrator.add(depositAmount);
      
      // Verify LP tokens
      const lpBalance = await freshMigrator.balanceOf(await owner.getAddress());
      expect(lpBalance.eq(depositAmount)).to.be.true;
      
      // Test migration flow
      await freshFromToken.mint(await user1.getAddress(), fromMigrateAmount);
      await freshFromToken.connect(user1).approve(freshMigrator.address, fromMigrateAmount);
      await freshMigrator.connect(user1).migrate(fromMigrateAmount);
      
      // Expected conversion (fromDecimals=8, toDecimals=18)
      const expectedToAmount = fromMigrateAmount.mul(ethers.BigNumber.from(10).pow(toDecimals - fromDecimals));
      const userBalance = await freshToToken.balanceOf(await user1.getAddress());
      expect(userBalance.eq(expectedToAmount)).to.be.true;

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

});