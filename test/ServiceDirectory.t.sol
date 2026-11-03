// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/ServiceDirectory.sol";

contract ServiceDirectoryTest is Test {
    ServiceDirectory public directory;
    address public provider = address(0x123);
    address public buyer = address(0x456);
    address public fakeNFT = address(0x789);

    function setUp() public {
        directory = new ServiceDirectory(fakeNFT);
    }

    function testRegisterService() public {
        vm.prank(provider);
        uint256 serviceId = directory.registerService("API de Datos", "Desc", 50000000000000000, "https://api.com", 0);
        assertEq(serviceId, 0, "ID incorrecto");
        ServiceDirectory.Service memory s = directory.getService(0);
        assertEq(s.provider, provider);
        assertEq(s.name, "API de Datos");
        assertTrue(s.active);
    }

    function testRevertEmptyName() public {
        vm.prank(provider);
        vm.expectRevert("Nombre vacio");
        directory.registerService("", "Desc", 100, "url", 0);
    }

    function testRevertZeroPrice() public {
        vm.prank(provider);
        vm.expectRevert("Precio debe ser mayor a 0");
        directory.registerService("API", "Desc", 0, "url", 0);
    }

    function testRevertEmptyEndpoint() public {
        vm.prank(provider);
        vm.expectRevert("Endpoint vacio");
        directory.registerService("API", "Desc", 100, "", 0);
    }

    function testToggleService() public {
        vm.prank(provider);
        directory.registerService("API", "Desc", 100, "url", 0);
        vm.prank(provider);
        directory.toggleService(0);
        ServiceDirectory.Service memory s = directory.getService(0);
        assertFalse(s.active);
    }

    function testOnlyProviderCanToggle() public {
        vm.prank(provider);
        directory.registerService("API", "Desc", 100, "url", 0);
        vm.prank(buyer);
        vm.expectRevert("No eres el proveedor");
        directory.toggleService(0);
    }

    function testGetServicesCount() public {
        assertEq(directory.getServicesCount(), 0);
        vm.prank(provider);
        directory.registerService("API 1", "Desc", 100, "url", 0);
        assertEq(directory.getServicesCount(), 1);
    }

    function testPauseBlocksRegistration() public {
        directory.pause();
        vm.prank(provider);
        vm.expectRevert();
        directory.registerService("API", "Desc", 100, "url", 0);
    }

    function testOnlyOwnerCanPause() public {
        vm.prank(buyer);
        vm.expectRevert();
        directory.pause();
    }
}
