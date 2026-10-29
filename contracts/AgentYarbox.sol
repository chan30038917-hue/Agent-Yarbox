// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentGate {
    function paymentNonces(bytes32 mandateId, bytes32 paymentNonce) external view returns (bool);
}

interface IMandateRegistry {
    struct Mandate {
        address agent;
        address token;
        uint256 maxPerTx;
        uint256 maxPerPeriod;
        uint256 periodSeconds;
        uint64  validUntil;
        bytes32 nonce;
    }
    function getMandate(bytes32 mandateId) external view returns (Mandate memory);
}

contract AgentYarbox {
    IPaymentGate public immutable paymentGate;
    IMandateRegistry public immutable mandateRegistry;

    struct Intent {
        address agent;
        uint64  erc8004AgentId;
        uint64  timestamp;
        bytes32 intentHash;
        bytes32 conditionHash;
        bytes32 mandateId;
        uint256 maxAmount;
        bytes32 paymentNonce;
        bytes32 resultHash;
        bool    settled;
        bool    inconsistent;
    }

    mapping(uint256 => Intent) public intents;
    mapping(address => uint256[]) public intentsByAgent;
    mapping(bytes32 => bool) public usedPaymentNonces;

    uint256 public totalIntents;

    event IntentCommitted(
        uint256 indexed id,
        address indexed agent,
        uint64  erc8004AgentId,
        bytes32 intentHash,
        bytes32 mandateId,
        uint256 maxAmount
    );

    event IntentSettled(
        uint256 indexed id,
        bytes32 paymentNonce,
        bytes32 resultHash,
        uint256 timestamp
    );

    event IntentInconsistent(
        uint256 indexed id,
        string reason
    );

    error EmptyIntent();
    error EmptyMandate();
    error EmptyAmount();
    error IntentNotFound();
    error AlreadySettled();
    error OnlyAgent();
    error EmptyNonce();
    error EmptyResult();
    error NonceAlreadyUsed();
    error PaymentNotFound();
    error AgentMismatch();
    error MandateMismatch();
    error AmountExceedsMax();
    error MandateExpired();
    error AlreadyInconsistent();

    constructor(address _paymentGate, address _mandateRegistry) {
        paymentGate = IPaymentGate(_paymentGate);
        mandateRegistry = IMandateRegistry(_mandateRegistry);
    }

    function commitIntent(
        bytes32 _intentHash,
        bytes32 _conditionHash,
        bytes32 _mandateId,
        uint256 _maxAmount,
        uint64 _erc8004AgentId
    ) external returns (uint256) {
        if (_intentHash == bytes32(0)) revert EmptyIntent();
        if (_mandateId == bytes32(0)) revert EmptyMandate();
        if (_maxAmount == 0) revert EmptyAmount();

        uint256 id = totalIntents;

        intents[id] = Intent({
            agent: msg.sender,
            erc8004AgentId: _erc8004AgentId,
            timestamp: uint64(block.timestamp),
            intentHash: _intentHash,
            conditionHash: _conditionHash,
            mandateId: _mandateId,
            maxAmount: _maxAmount,
            paymentNonce: bytes32(0),
            resultHash: bytes32(0),
            settled: false,
            inconsistent: false
        });

        intentsByAgent[msg.sender].push(id);
        unchecked { totalIntents++; }

        emit IntentCommitted(id, msg.sender, _erc8004AgentId, _intentHash, _mandateId, _maxAmount);
        return id;
    }

    function settleIntent(
        uint256 _id,
        bytes32 _paymentNonce,
        bytes32 _resultHash
    ) external {
        Intent storage it = intents[_id];

        if (it.agent == address(0)) revert IntentNotFound();
        if (it.settled) revert AlreadySettled();
        if (it.inconsistent) revert AlreadyInconsistent();
        if (msg.sender != it.agent) revert OnlyAgent();
        if (_paymentNonce == bytes32(0)) revert EmptyNonce();
        if (_resultHash == bytes32(0)) revert EmptyResult();
        if (usedPaymentNonces[_paymentNonce]) revert NonceAlreadyUsed();

        // Verificar que el pago existe en PaymentGate
        if (!paymentGate.paymentNonces(it.mandateId, _paymentNonce)) {
            it.inconsistent = true;
            emit IntentInconsistent(_id, "payment not found");
            return;
        }

        // Verificar que el mandato existe y no expiró
        IMandateRegistry.Mandate memory m = mandateRegistry.getMandate(it.mandateId);
        if (m.agent != it.agent) {
            it.inconsistent = true;
            emit IntentInconsistent(_id, "mandate agent mismatch");
            return;
        }
        if (m.validUntil < block.timestamp) {
            it.inconsistent = true;
            emit IntentInconsistent(_id, "mandate expired");
            return;
        }

        // Todo cuadra: liquidar
        it.paymentNonce = _paymentNonce;
        it.resultHash = _resultHash;
        it.settled = true;
        usedPaymentNonces[_paymentNonce] = true;

        emit IntentSettled(_id, _paymentNonce, _resultHash, block.timestamp);
    }

    function getIntentsByAgent(address _agent) external view returns (uint256[] memory) {
        return intentsByAgent[_agent];
    }

    function isPaymentNonceUsed(bytes32 _nonce) external view returns (bool) {
        return usedPaymentNonces[_nonce];
    }
}
