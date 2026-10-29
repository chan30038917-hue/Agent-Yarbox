// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgentYarbox.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address paymentGate = vm.envAddress("PAYMENT_GATE");
        address mandateRegistry = vm.envAddress("MANDATE_REGISTRY");

        vm.startBroadcast(pk);

        AgentYarbox yarbox = new AgentYarbox(paymentGate, mandateRegistry);

        vm.stopBroadcast();

        console.log("AgentYarbox deployed at:", address(yarbox));
        console.log("PaymentGate:", paymentGate);
        console.log("MandateRegistry:", mandateRegistry);
    }
}
