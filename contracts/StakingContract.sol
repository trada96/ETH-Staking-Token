// SPDX-License-Identifier: UNLICENSE

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelincontracts/security/Pausable.sol";
import "./access/AccessControl.sol";

contract StakingContract is AccessControl, Pausable {
    using SafeMath for uint256;

    IERC20 public token;

    uint256 private _minAmount;
    uint256 private _stakeDuration;
    uint256 private _profitPercent;
    uint256 private _id = 1;

    function _getId() private returns (uint256) {
        return _id++;
    }

    struct Stake {
        uint256 startTime;
        address holder;
        uint256 amount;
        bool closed;
    }

    mapping(address => uint256[]) private _userStakeIds;
    mapping(uint256 => Stake) private _stakeMap;
    mapping(address => bool) private existStaker;
    address[] public all_holders;

    //  EVENT
    event Staked(address token, uint256 id);
    event Rewarded(address token, uint256 id);
    event Canceled(address token, uint256 id);

    constructor(
        address _token,
        uint256 minAmount,
        uint256 profitPercent,
        uint256 stakeDuration
    ) {
        require(minAmount > 0, "Stake amount must be greater than 0");
        require(stakeDuration > 0, "Stake duration must be greater than 0");
        require(profitPercent <= 100, "Profit Percent must be less than 100");

        token = IERC20(_token);
        _minAmount = minAmount;
        _stakeDuration = stakeDuration;
        _profitPercent = profitPercent;
    }

    function balanceOfContract() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function getMinAmount() public view returns (uint256 minAmount) {
        return _minAmount;
    }

    function setMinAmount(uint256 minAmount) external onlyOperator {
        require(minAmount > 0, "Stake amount must be greater than 0");
        _minAmount = minAmount;
    }

    function getStakeDuration() public view returns (uint256 minAmount) {
        return _stakeDuration;
    }

    function setStakeDuration(uint256 stakeDuration) external onlyOperator {
        require(stakeDuration > 0, "Stake duration must be greater than 0");
        _stakeDuration = stakeDuration;
    }

    function getProfitPercent() public view returns (uint256 minAmount) {
        return _profitPercent;
    }

    function setProfitPercent(uint256 profitPercent) external onlyOperator {
        // require(profitPercent <= 100, "Profit Percent must be less than 100");
        _profitPercent = profitPercent;
    }

    function getStakeByID(uint256 _stakeId)
        external
        view
        returns (Stake memory)
    {
        return _stakeMap[_stakeId];
    }

    function getStakeByUser(address holder)
        external
        view
        returns (uint256[] memory)
    {
        return _userStakeIds[holder];
    }

    function getAllHolder() external view onlyOwner returns (address[] memory) {
        return all_holders;
    }

    function stake(uint256 amount) external {
        require(!paused(), "Paused!");
        require(amount >= _minAmount, "Amount Staking is not Enough");

        address holder = msg.sender;

        token.transferFrom(holder, address(this), amount);
        uint256 stake_id = _getId();

        Stake memory newStake;

        newStake.holder = holder;
        newStake.startTime = block.timestamp;
        newStake.amount = amount;

        _stakeMap[stake_id] = newStake;
        _userStakeIds[holder].push(stake_id);

        if (existStaker[holder] == false) {
            existStaker[holder] = true;
            all_holders.push(holder);
        }

        emit Staked(newStake.holder, stake_id);
    }

    function cancelStake(uint256 stakeId) external {
        require(
            _stakeMap[stakeId].holder == msg.sender,
            "Do not have permission"
        );

        require(!_stakeMap[stakeId].closed, "closed");
        require(
            block.timestamp < _stakeMap[stakeId].startTime.add(_stakeDuration),
            "Must claim!"
        );

        uint256 amount = _stakeMap[stakeId].amount;
        require(balanceOfContract() >= amount, "Not Enough Token To Pay!");

        token.transfer(_stakeMap[stakeId].holder, amount);
        _removeStake(stakeId);
    }

    function _removeStake(uint256 stakeId) private {
        _stakeMap[stakeId].closed = true;
    }

    function claimReward(uint256 stakeId) public {
        require(!paused(), "Paused!");
        require(_stakeMap[stakeId].holder == msg.sender, "Wrong holder!");
        require(_stakeMap[stakeId].closed == false, "Can not claim!");
        require(
            block.timestamp >= _stakeMap[stakeId].startTime.add(_stakeDuration),
            "Too Early!"
        );

        uint256 reward = _stakeMap[stakeId]
            .amount
            .mul(100 + _profitPercent)
            .div(100);
        require(balanceOfContract() >= reward, "Not Enough Token To Pay!");

        token.transfer(_stakeMap[stakeId].holder, reward);

        emit Rewarded(_stakeMap[stakeId].holder, stakeId);
        _removeStake(stakeId);
        return;
    }

    function claimRewardable(uint256 stakeId) external view returns (bool) {
        if (
            block.timestamp >
            _stakeMap[stakeId].startTime.add(_stakeDuration) &&
            _stakeMap[stakeId].closed == false
        ) {
            return true;
        } else {
            return false;
        }
    }


    function withdrawForOwner(uint256 _amount) public onlyOwner {
        require(balanceOfContract() >= _amount, "Not Enough Token To Pay!");
        token.transfer(msg.sender, _amount);

    }
}
