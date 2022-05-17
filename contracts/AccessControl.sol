// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/Context.sol";

abstract contract AccessControl is Context{
    address public owner;
    mapping(address=> bool) private operators;

    constructor() {
          owner = _msgSender();
          operators[owner] = true;
      }


    function hasRole(address account) public view virtual returns (bool) {
        return operators[account];
    }


    modifier onlyOwner() {
      require(_msgSender() == owner, "OnlyAdmin");
      _;
    }

    modifier onlyOperator() {
      require(hasRole(_msgSender())== true, "OnlyOperator");
      _;
    }


    function setOwner(address newOwner) external onlyOwner {
      require(newOwner != address(0));

      operators[owner] = false;
      owner = newOwner;
      operators[newOwner] = true;
    }
    
    function addOperator(address newOperator) external  onlyOwner {
      require(newOperator != address(0));
      operators[newOperator] = true;
    }

    function removeOperator(address operator) external  onlyOwner {
      require(operator != address(0));
      require(operator != owner);
      operators[operator] = false;
    }

}