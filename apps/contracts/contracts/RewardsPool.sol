// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MGTToken.sol";

/**
 * @title RewardsPool
 * @notice Manages reward distribution for staking, missions, PvP, and F2P
 */
contract RewardsPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    MGTToken public immutable mgtToken;
    IERC20 public immutable usdcToken;

    // Distribution buckets (basis points)
    uint256 public constant STAKING_BPS = 4000; // 40%
    uint256 public constant MISSIONS_BPS = 2000; // 20%
    uint256 public constant PVP_BPS = 1500; // 15%
    uint256 public constant F2P_BPS = 1500; // 15%
    uint256 public constant PASSES_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Monthly emission
    uint256 public constant MONTHLY_EMISSION = 8_333_333 * 1e18; // ~8.3M MGT
    uint256 public lastEmissionTimestamp;

    // Whitelisted reward recipients
    mapping(address => bool) public whitelistedRecipients;

    // Reward tracking
    mapping(address => uint256) public totalRewardsDistributed;
    mapping(address => mapping(string => uint256)) public categoryDistributions;

    event RewardDistributed(
        address indexed recipient,
        uint256 amount,
        string category,
        string reason
    );
    event RecipientWhitelisted(address indexed recipient, bool status);
    event EmissionMinted(uint256 amount);

    error RecipientNotWhitelisted(address recipient);
    error ExceedsMonthlyEmission(uint256 requested, uint256 available);

    constructor(address _mgtToken, address _usdcToken) {
        mgtToken = MGTToken(_mgtToken);
        usdcToken = IERC20(_usdcToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        lastEmissionTimestamp = block.timestamp;
    }

    /**
     * @notice Distribute MGT reward to a recipient
     * @param recipient Address to receive reward
     * @param amount Amount of MGT
     * @param category Category of reward (staking, missions, pvp, f2p, pass)
     * @param reason Description of reward
     */
    function distributeReward(
        address recipient,
        uint256 amount,
        string calldata category,
        string calldata reason
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused {
        if (!whitelistedRecipients[recipient]) {
            revert RecipientNotWhitelisted(recipient);
        }

        // Check monthly emission limit
        _checkEmission(amount);

        mgtToken.mint(recipient, amount);

        totalRewardsDistributed[recipient] += amount;
        categoryDistributions[recipient][category] += amount;

        emit RewardDistributed(recipient, amount, category, reason);
    }

    /**
     * @notice Distribute USDC reward (from marketplace fees, etc.)
     * @param recipient Address to receive reward
     * @param amount Amount of USDC
     * @param reason Description of reward
     */
    function distributeUSDC(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused {
        usdcToken.safeTransfer(recipient, amount);
        emit RewardDistributed(recipient, amount, "usdc", reason);
    }

    /**
     * @notice Batch distribute rewards
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts
     * @param category Category of rewards
     * @param reason Description
     */
    function batchDistribute(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata category,
        string calldata reason
    ) external onlyRole(DISTRIBUTOR_ROLE) whenNotPaused {
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            if (!whitelistedRecipients[recipients[i]]) {
                revert RecipientNotWhitelisted(recipients[i]);
            }

            _checkEmission(amounts[i]);
            mgtToken.mint(recipients[i], amounts[i]);

            totalRewardsDistributed[recipients[i]] += amounts[i];
            categoryDistributions[recipients[i]][category] += amounts[i];

            emit RewardDistributed(recipients[i], amounts[i], category, reason);
        }
    }

    /**
     * @notice Whitelist a recipient address
     * @param recipient Address to whitelist
     * @param status Whitelist status
     */
    function setRecipientWhitelist(address recipient, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        whitelistedRecipients[recipient] = status;
        emit RecipientWhitelisted(recipient, status);
    }

    function _checkEmission(uint256 amount) internal {
        uint256 timeSinceLastEmission = block.timestamp - lastEmissionTimestamp;
        uint256 availableEmission = (MONTHLY_EMISSION * timeSinceLastEmission) / 30 days;

        if (amount > availableEmission) {
            revert ExceedsMonthlyEmission(amount, availableEmission);
        }

        lastEmissionTimestamp = block.timestamp;
    }

    /**
     * @notice Get reward stats for a user
     * @param user Address to check
     * @return total Total rewards received
     */
    function getUserRewardStats(address user) external view returns (uint256 total) {
        return totalRewardsDistributed[user];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
