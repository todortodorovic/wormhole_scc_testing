// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "../Messages.sol";
import "../Setters.sol";

contract ExportedMessages is Messages, Setters {
    function storeGuardianSetPub(Structs.GuardianSet memory set, uint32 index) public {
        return super.storeGuardianSet(set, index);
    }
}