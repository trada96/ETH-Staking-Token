const StakingContract = artifacts.require("./StakingContract.sol");
require('dotenv').config();


module.exports = function(deployer) {
    deployer.deploy(StakingContract, process.env.TOKEN, process.env.MIN_AMOUNT, process.env.PROFIT, process.env.MIN_DURATION);
};