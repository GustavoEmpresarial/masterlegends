// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title StakingVault
 * @notice Staking vault for MGT tokens with 18% APR
 */
contract StakingVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REWARDS_ROLE = keccak256("REWARDS_ROLE");

    IERC20 public immutable mgtToken;
    address public rewardsPool;

    uint256 public constant APR_BPS = 1800; // 18%
    uint256 public constant APR_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MIN_STAKE_DURATION = 30 days;
    uint256 public constant EARLY_EXIT_PENALTY_BPS = 5000; // 50%

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastRewardAt;
        uint256 accumulatedReward;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);

    error InsufficientAmount();
    error NothingToUnstake();
    error InsufficientRewardBalance(uint256 requested, uint256 available);

    constructor(address _mgtToken, address _rewardsPool) {
        mgtToken = IERC20(_mgtToken);
        rewardsPool = _rewardsPool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARDS_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Stake MGT tokens
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InsufficientAmount();

        // Update rewards before modifying stake
        _updateRewards(msg.sender);

        mgtToken.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = stakes[msg.sender].stakedAt == 0 ? block.timestamp : stakes[msg.sender].stakedAt;
        stakes[msg.sender].lastRewardAt = block.timestamp;

        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake MGT tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (stakeInfo.amount < amount) revert NothingToUnstake();

        // Update rewards
        _updateRewards(msg.sender);

        uint256 reward = stakeInfo.accumulatedReward;
        uint256 penalty = 0;

        // Check if early exit
        if (block.timestamp - stakeInfo.stakedAt < MIN_STAKE_DURATION) {
            penalty = (reward * EARLY_EXIT_PENALTY_BPS) / APR_DENOMINATOR;
            reward -= penalty;
        }

        // Update state
        stakeInfo.amount -= amount;
        totalStaked -= amount;

        if (stakeInfo.amount == 0) {
            delete stakes[msg.sender];
        }

        // Transfer tokens
        mgtToken.safeTransfer(msg.sender, amount + reward);

        emit Unstaked(msg.sender, amount, reward, penalty);
    }

    /**
     * @notice Claim accumulated rewards
     */
    function claimReward() external nonReentrant {
        _updateRewards(msg.sender);

        StakeInfo storage stakeInfo = stakes[msg.sender];
        uint256 reward = stakeInfo.accumulatedReward;

        if (reward == 0) return;

        stakeInfo.accumulatedReward = 0;
        mgtToken.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Add rewards to the pool (only REWARDS_ROLE)
     * @param amount Amount to add
     */
    function addRewards(uint256 amount) external onlyRole(REWARDS_ROLE) {
        mgtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardAdded(amount);
    }

    function _updateRewards(address user) internal {
        StakeInfo storage stakeInfo = stakes[user];
        if (stakeInfo.amount == 0) return;

        uint256 duration = block.timestamp - stakeInfo.lastRewardAt;
        uint256 reward = (stakeInfo.amount * APR_BPS * duration) / (APR_DENOMINATOR * SECONDS_PER_YEAR);

        stakeInfo.accumulatedReward += reward;
        stakeInfo.lastRewardAt = block.timestamp;
    }

    /**
     * @notice Get pending rewards for a user
     * @param user Address to check
     * @return pending Pending rewards
     */
    function getPendingRewards(address user) external view returns (uint256 pending) {
        StakeInfo storage stakeInfo = stakes[user];
        if (stakeInfo.amount == 0) return 0;

        uint256 duration = block.timestamp - stakeInfo.lastRewardAt;
        uint256 reward = (stakeInfo.amount * APR_BPS * duration) / (APR_DENOMINATOR * SECONDS_PER_YEAR);

        return stakeInfo.accumulatedReward + reward;
    }

    /**
     * @notice Get stake info for a user
     * @param user Address to check
     * @return info Stake info struct
     */
    function getStakeInfo(address user) external view returns (StakeInfo memory info) {
        return stakes[user];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
