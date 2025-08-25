import hre from "hardhat"

describe("RPC Node Connectivity", () => {
    it("should connect to ethRpcNode network", async () => {
        try {
            console.log("🔌 Attempting to connect to RPC node...")
            
            // Get the network configuration
            const network = await hre.ethers.provider.getNetwork()
            console.log("✅ Connected to network:", network.name)
            console.log("🔗 Chain ID:", network.chainId.toString())
            
            // Get the latest block number
            const latestBlock = await hre.ethers.provider.getBlockNumber()
            console.log("📦 Latest block number:", latestBlock)
            
            // Get account balance
            const [owner] = await hre.ethers.getSigners()
            const balance = await hre.ethers.provider.getBalance(owner.address)
            console.log("💰 Owner address:", owner.address)
            console.log("💎 Owner balance:", hre.ethers.utils.formatEther(balance), "ETH")
            
            // Get gas price
            const gasPrice = await hre.ethers.provider.getFeeData()
            console.log("⛽ Gas price:", hre.ethers.utils.formatUnits(gasPrice.gasPrice || 0, "gwei"), "gwei")
            
            console.log("🎉 RPC connection successful!")
            
        } catch (error) {
            console.error("❌ Failed to connect to RPC node:")
            console.error(error)
            throw error
        }
    })

    it("should deploy a simple contract", async () => {
        try {
            console.log("🚀 Attempting to deploy a simple contract...")
            
            // Get signers
            const [owner] = await hre.ethers.getSigners()
            console.log("👤 Deployer address:", owner.address)
            
            // Get balance before deployment
            const balanceBefore = await hre.ethers.provider.getBalance(owner.address)
            console.log("💰 Balance before deployment:", hre.ethers.utils.formatEther(balanceBefore), "ETH")
            
            // Try to get nonce
            const nonce = await hre.ethers.provider.getTransactionCount(owner.address)
            console.log("🔢 Current nonce:", nonce)
            
            console.log("✅ Basic contract deployment check passed!")
            
        } catch (error) {
            console.error("❌ Contract deployment check failed:")
            console.error(error)
            throw error
        }
    })
})
