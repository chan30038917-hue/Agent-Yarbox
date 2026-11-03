// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IReputationNFT {
    function balanceOf(address owner) external view returns (uint256);
}

contract ServiceDirectory is ReentrancyGuard, Pausable, Ownable {
    
    struct Service {
        address provider;
        string name;
        string description;
        uint256 price;
        string endpoint;
        bool active;
        uint256 reputationRequired;
    }

    Service[] public services;
    mapping(address => uint256[]) public servicesByProvider;
    
    IReputationNFT public reputationNFT;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, string name, uint256 price);
    event ServiceUpdated(uint256 indexed serviceId, bool active);

    constructor(address _reputationNFT) Ownable(msg.sender) {
        require(_reputationNFT != address(0), "ReputationNFT invalido");
        reputationNFT = IReputationNFT(_reputationNFT);
    }

    // Solo el owner (tu Multisig) puede pausar
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function registerService(
        string memory _name,
        string memory _description,
        uint256 _price,
        string memory _endpoint,
        uint256 _reputationRequired
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(bytes(_name).length > 0, "Nombre vacio");
        require(_price > 0, "Precio debe ser mayor a 0");
        require(bytes(_endpoint).length > 0, "Endpoint vacio");
        require(servicesByProvider[msg.sender].length < 100, "Limite de servicios alcanzado");

        uint256 serviceId = services.length;
        services.push(Service({
            provider: msg.sender,
            name: _name,
            description: _description,
            price: _price,
            endpoint: _endpoint,
            active: true,
            reputationRequired: _reputationRequired
        }));
        servicesByProvider[msg.sender].push(serviceId);
        emit ServiceRegistered(serviceId, msg.sender, _name, _price);
        return serviceId;
    }

    function toggleService(uint256 _serviceId) external nonReentrant whenNotPaused {
        require(_serviceId < services.length, "Servicio no existe");
        require(services[_serviceId].provider == msg.sender, "No eres el proveedor");
        services[_serviceId].active = !services[_serviceId].active;
        emit ServiceUpdated(_serviceId, services[_serviceId].active);
    }

    function canPurchase(address _agent, uint256 _serviceId) external view returns (bool) {
        require(_serviceId < services.length, "Servicio no existe");
        Service memory s = services[_serviceId];
        if (!s.active) return false;
        uint256 nftBalance = reputationNFT.balanceOf(_agent);
        return nftBalance >= s.reputationRequired;
    }

    function getServicesCount() external view returns (uint256) {
        return services.length;
    }

    function getService(uint256 _serviceId) external view returns (Service memory) {
        require(_serviceId < services.length, "Servicio no existe");
        return services[_serviceId];
    }
}
