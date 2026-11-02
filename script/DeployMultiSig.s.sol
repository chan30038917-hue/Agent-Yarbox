// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../multisig/MultiSig.sol";

contract DeployMultiSig is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address owner1 = 0xF6805F61820A860db4B7462Bc9940793fC8ed22A;
        address owner2 = 0xF6805F61820A860db4B7462Bc9940793fC8ed22A;
        address owner3 = 0xF6805F61820A860db4B7462Bc9940793fC8ed22A;

        MultiSig multisig = new MultiSig(owner1, owner2, owner3);
        console.log("MultiSig deployed to:", address(multisig));

        vm.stopBroadcast();
    }
}
