// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MultiSig {
    address[3] public owners;
    uint public required = 2;
    
    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint confirmations;
    }
    
    Transaction[] public transactions;
    mapping(uint => mapping(address => bool)) public confirmed;
    
    constructor(address _owner1, address _owner2, address _owner3) {
        owners = [_owner1, _owner2, _owner3];
        
    }
    
    modifier onlyOwner() {
        bool isOwner = false;
        for(uint i = 0; i < 3; i++) {
            if(owners[i] == msg.sender) isOwner = true;
        }
        require(isOwner, "No eres owner");
        _;
    }
    
    function submitTransaction(address _to, uint _value, bytes memory _data) public onlyOwner {
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            confirmations: 0
        }));
    }
    
    function confirmTransaction(uint _txId) public onlyOwner {
        require(!confirmed[_txId][msg.sender], "Ya confirmaste");
        confirmed[_txId][msg.sender] = true;
        transactions[_txId].confirmations++;
    }
    
    function executeTransaction(uint _txId) public onlyOwner {
        Transaction storage txn = transactions[_txId];
        require(txn.confirmations >= required, "Faltan firmas");
        require(!txn.executed, "Ya ejecutada");
        txn.executed = true;
        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Fallo la ejecucion");
    }
    
    receive() external payable {}
}
