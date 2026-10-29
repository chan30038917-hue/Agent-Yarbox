// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentYarbox.sol";

contract AgentYarboxTest is Test {
    AgentYarbox yarbox;

    address agent = address(0xA11CE);
    address other = address(0xB0B);

    bytes32 constant INTENT_HASH = keccak256("strategy-v1");
    bytes32 constant CONDITION_HASH = keccak256("apy>5");
    bytes32 constant MANDATE_ID = keccak256("mandate-1");
    bytes32 constant PAYMENT_NONCE = keccak256("nonce-1");
    bytes32 constant RESULT_HASH = keccak256("result-1");
    uint256 constant MAX_AMOUNT = 1 ether;
    uint64 constant ERC8004_ID = 42;

    function setUp() public {
        yarbox = new AgentYarbox(
            address(0x1111), // paymentGate mock
            address(0x2222)  // mandateRegistry mock
        );
    }

    function testCommitIntent() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(
            INTENT_HASH,
            CONDITION_HASH,
            MANDATE_ID,
            MAX_AMOUNT,
            ERC8004_ID
        );

        assertEq(id, 0);
        assertEq(yarbox.totalIntents(), 1);

        (
            address a,
            uint64 eid,
            uint64 ts,
            bytes32 ih,
            bytes32 ch,
            bytes32 mid,
            uint256 ma,
            bytes32 pn,
            bytes32 rh,
            bool settled,
            bool inconsistent
        ) = yarbox.intents(id);

        assertEq(a, agent);
        assertEq(eid, ERC8004_ID);
        assertEq(ih, INTENT_HASH);
        assertEq(ch, CONDITION_HASH);
        assertEq(mid, MANDATE_ID);
        assertEq(ma, MAX_AMOUNT);
        assertEq(pn, bytes32(0));
        assertEq(rh, bytes32(0));
        assertFalse(settled);
        assertFalse(inconsistent);
    }

    function testCommitIntentEmptyHash() public {
        vm.prank(agent);
        vm.expectRevert(AgentYarbox.EmptyIntent.selector);
        yarbox.commitIntent(bytes32(0), CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);
    }

    function testCommitIntentEmptyMandate() public {
        vm.prank(agent);
        vm.expectRevert(AgentYarbox.EmptyMandate.selector);
        yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, bytes32(0), MAX_AMOUNT, ERC8004_ID);
    }

    function testCommitIntentEmptyAmount() public {
        vm.prank(agent);
        vm.expectRevert(AgentYarbox.EmptyAmount.selector);
        yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, 0, ERC8004_ID);
    }

    function testGetIntentsByAgent() public {
        vm.prank(agent);
        yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        vm.prank(agent);
        yarbox.commitIntent(keccak256("strategy-v2"), CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        uint256[] memory ids = yarbox.getIntentsByAgent(agent);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
    }

    function testSettleIntentNotAgent() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        vm.prank(other);
        vm.expectRevert(AgentYarbox.OnlyAgent.selector);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);
    }

    function testSettleIntentAlreadySettled() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        // Simular que ya está settled
        vm.prank(agent);
        vm.mockCall(
            address(0x1111),
            abi.encodeWithSelector(IPaymentGate.paymentNonces.selector, MANDATE_ID, PAYMENT_NONCE),
            abi.encode(true)
        );
        vm.mockCall(
            address(0x2222),
            abi.encodeWithSelector(IMandateRegistry.getMandate.selector, MANDATE_ID),
            abi.encode(IMandateRegistry.Mandate({
                agent: agent,
                token: address(0),
                maxPerTx: MAX_AMOUNT,
                maxPerPeriod: MAX_AMOUNT,
                periodSeconds: 86400,
                validUntil: uint64(block.timestamp + 86400),
                nonce: bytes32(0)
            }))
        );

        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);

        // Intentar liquidar de nuevo
        vm.prank(agent);
        vm.expectRevert(AgentYarbox.AlreadySettled.selector);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);
    }

    function testSettleIntentPaymentNotFound() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        // Mock: paymentNonces devuelve false (pago no existe)
        vm.mockCall(
            address(0x1111),
            abi.encodeWithSelector(IPaymentGate.paymentNonces.selector, MANDATE_ID, PAYMENT_NONCE),
            abi.encode(false)
        );

        vm.prank(agent);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);

        (, , , , , , , , , bool settled, bool inconsistent) = yarbox.intents(id);
        assertFalse(settled);
        assertTrue(inconsistent);
    }

    function testSettleIntentMandateExpired() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        // Mock: pago existe
        vm.mockCall(
            address(0x1111),
            abi.encodeWithSelector(IPaymentGate.paymentNonces.selector, MANDATE_ID, PAYMENT_NONCE),
            abi.encode(true)
        );

        // Mock: mandato expirado
        vm.mockCall(
            address(0x2222),
            abi.encodeWithSelector(IMandateRegistry.getMandate.selector, MANDATE_ID),
            abi.encode(IMandateRegistry.Mandate({
                agent: agent,
                token: address(0),
                maxPerTx: MAX_AMOUNT,
                maxPerPeriod: MAX_AMOUNT,
                periodSeconds: 86400,
                validUntil: uint64(block.timestamp - 1), // expirado
                nonce: bytes32(0)
            }))
        );

        vm.prank(agent);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);

        (, , , , , , , , , bool settled, bool inconsistent) = yarbox.intents(id);
        assertFalse(settled);
        assertTrue(inconsistent);
    }

    function testSettleIntentNonceAlreadyUsed() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        // Mock: pago existe
        vm.mockCall(
            address(0x1111),
            abi.encodeWithSelector(IPaymentGate.paymentNonces.selector, MANDATE_ID, PAYMENT_NONCE),
            abi.encode(true)
        );

        // Mock: mandato válido
        vm.mockCall(
            address(0x2222),
            abi.encodeWithSelector(IMandateRegistry.getMandate.selector, MANDATE_ID),
            abi.encode(IMandateRegistry.Mandate({
                agent: agent,
                token: address(0),
                maxPerTx: MAX_AMOUNT,
                maxPerPeriod: MAX_AMOUNT,
                periodSeconds: 86400,
                validUntil: uint64(block.timestamp + 86400),
                nonce: bytes32(0)
            }))
        );

        // Liquidar una vez
        vm.prank(agent);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);

        // Intentar usar el mismo nonce en otro intent
        vm.prank(agent);
        uint256 id2 = yarbox.commitIntent(keccak256("strategy-v2"), CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        vm.prank(agent);
        vm.expectRevert(AgentYarbox.NonceAlreadyUsed.selector);
        yarbox.settleIntent(id2, PAYMENT_NONCE, RESULT_HASH);
    }

    function testSettleIntentSuccess() public {
        vm.prank(agent);
        uint256 id = yarbox.commitIntent(INTENT_HASH, CONDITION_HASH, MANDATE_ID, MAX_AMOUNT, ERC8004_ID);

        // Mock: pago existe
        vm.mockCall(
            address(0x1111),
            abi.encodeWithSelector(IPaymentGate.paymentNonces.selector, MANDATE_ID, PAYMENT_NONCE),
            abi.encode(true)
        );

        // Mock: mandato válido
        vm.mockCall(
            address(0x2222),
            abi.encodeWithSelector(IMandateRegistry.getMandate.selector, MANDATE_ID),
            abi.encode(IMandateRegistry.Mandate({
                agent: agent,
                token: address(0),
                maxPerTx: MAX_AMOUNT,
                maxPerPeriod: MAX_AMOUNT,
                periodSeconds: 86400,
                validUntil: uint64(block.timestamp + 86400),
                nonce: bytes32(0)
            }))
        );

        vm.prank(agent);
        yarbox.settleIntent(id, PAYMENT_NONCE, RESULT_HASH);

        (, , , , , , , bytes32 pn, bytes32 rh, bool settled, bool inconsistent) = yarbox.intents(id);
        assertEq(pn, PAYMENT_NONCE);
        assertEq(rh, RESULT_HASH);
        assertTrue(settled);
        assertFalse(inconsistent);
        assertTrue(yarbox.isPaymentNonceUsed(PAYMENT_NONCE));
    }
}
