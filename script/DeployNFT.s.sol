// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/ReputationNFT.sol";

contract DeployNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address agentYarbox = 0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC;

        ReputationNFT nft = new ReputationNFT(agentYarbox);
        console.log("ReputationNFT deployed to:", address(nft));

        vm.stopBroadcast();
    }
}
