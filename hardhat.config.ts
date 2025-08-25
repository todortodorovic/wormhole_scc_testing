import { HardhatUserConfig } from "hardhat/config"
import "@nomiclabs/hardhat-ethers"
import "@parity/hardhat-polkadot"

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    defaultNetwork: "ethRpcNode",
    networks: {
        hardhat: {
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: "./bin/revive-dev-node",
                rpcPort: 9944,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: "./bin/eth-rpc",
                dev: true,
            },
        },
        ethRpcNode: {
            polkavm: true,
            url: "http://127.0.0.1:8545",
        },
    },
}

export default config

