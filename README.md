# Wormhole SCC Testing

This project is a migration of Foundry tests to Hardhat TypeScript for the Wormhole protocol. It provides comprehensive smart contract testing using Hardhat's TypeScript environment.
## Setup

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```


## Running the Development Environment

You need to start two separate binaries in different terminals:

### Terminal 1 - Revive Dev Node
```bash
/YOUR_PATH/bin/revive-dev-node --dev
```

### Terminal 2 - ETH RPC
```bash
/YOUR_PATH/bin/eth-rpc --dev
```

## Available Commands

### Compilation
```bash
# Compile all contracts
npx hardhat compile
```

### Testing
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/Bridge.test.ts
```

### Running Scripts
```bash
# Run deployment scripts
npx hardhat run scripts/DeployNFTBridge.ts


