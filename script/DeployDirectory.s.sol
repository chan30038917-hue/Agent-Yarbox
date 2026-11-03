// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/ServiceDirectory.sol";

contract DeployDirectory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Dirección del ReputationNFT que ya desplegaste
        address reputationNFT = 0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8;

        ServiceDirectory directory = new ServiceDirectory(reputationNFT);
        console.log("ServiceDirectory deployed to:", address(directory));

        vm.stopBroadcast();
    }
}
