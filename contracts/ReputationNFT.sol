// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationNFT is ERC721, Ownable {
    uint256 public nextTokenId;
    address public agentYarbox;

    struct ReceiptData {
        uint256 intentId;
        address agent;
        uint256 maxAmount;
        bytes32 paymentNonce;
        uint256 timestamp;
    }

    mapping(uint256 => ReceiptData) public receipts;

    event ReceiptMinted(uint256 indexed tokenId, address indexed agent, uint256 intentId);

    constructor(address _agentYarbox) ERC721("AgentYarbox Receipt", "AYR") Ownable(msg.sender) {
        agentYarbox = _agentYarbox;
    }

    modifier onlyAgentYarbox() {
        require(msg.sender == agentYarbox || msg.sender == owner(), "Solo AgentYarbox o Owner");
        _;
    }

    function mintReceipt(
        address _agent,
        uint256 _intentId,
        uint256 _maxAmount,
        bytes32 _paymentNonce,
        uint256 _timestamp
    ) external onlyAgentYarbox returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(_agent, tokenId);
        
        receipts[tokenId] = ReceiptData({
            intentId: _intentId,
            agent: _agent,
            maxAmount: _maxAmount,
            paymentNonce: _paymentNonce,
            timestamp: _timestamp
        });

        emit ReceiptMinted(tokenId, _agent, _intentId);
        return tokenId;
    }
}
