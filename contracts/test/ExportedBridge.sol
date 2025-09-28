// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "../bridge/BridgeImplementation.sol";

contract ExportedBridge is BridgeImplementation {
    function _truncateAddressPub(bytes32 b) public pure returns (address) {
        return super._truncateAddress(b);
    }

    function setChainIdPub(uint16 chainId) public {
        return super.setChainId(chainId);
    }

    function setEvmChainIdPub(uint256 evmChainId) public {
        return super.setEvmChainId(evmChainId);
    }
}