// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title USDCPlayerVault
 * @notice Custodial USDC balance per player wallet on Polygon with manual withdrawal queue
 */
contract USDCPlayerVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable usdcToken;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public pendingWithdraw;

    uint256 public minDeposit;
    uint256 public minWithdraw;

    event Deposited(address indexed user, uint256 amount);
    event WithdrawRequested(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event WithdrawReleased(address indexed user, uint256 amount);
    event LimitsUpdated(uint256 minDeposit, uint256 minWithdraw);

    error BelowMinDeposit(uint256 amount, uint256 minimum);
    error BelowMinWithdraw(uint256 amount, uint256 minimum);
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientPending(uint256 requested, uint256 pending);

    constructor(address _usdcToken, uint256 _minDeposit, uint256 _minWithdraw) {
        usdcToken = IERC20(_usdcToken);
        minDeposit = _minDeposit;
        minWithdraw = _minWithdraw;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount < minDeposit) {
            revert BelowMinDeposit(amount, minDeposit);
        }

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Operator locks user balance when admin approves withdrawal request
    function operatorLockWithdraw(address user, uint256 amount) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        if (amount < minWithdraw) {
            revert BelowMinWithdraw(amount, minWithdraw);
        }
        uint256 available = balances[user];
        if (available < amount) {
            revert InsufficientBalance(amount, available);
        }
        balances[user] = available - amount;
        pendingWithdraw[user] += amount;
        emit WithdrawRequested(user, amount);
    }

    /// @notice Lock funds for admin-approved withdrawal queue (player-initiated optional path)
    function requestWithdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount < minWithdraw) {
            revert BelowMinWithdraw(amount, minWithdraw);
        }

        uint256 available = balances[msg.sender];
        if (available < amount) {
            revert InsufficientBalance(amount, available);
        }

        balances[msg.sender] = available - amount;
        pendingWithdraw[msg.sender] += amount;

        emit WithdrawRequested(msg.sender, amount);
    }

    /// @notice Operator completes withdrawal after admin approval
    function fulfillWithdraw(address user, uint256 amount) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        uint256 pending = pendingWithdraw[user];
        if (pending < amount) {
            revert InsufficientPending(amount, pending);
        }

        pendingWithdraw[user] = pending - amount;
        usdcToken.safeTransfer(user, amount);

        emit Withdrawn(user, amount);
    }

    /// @notice Operator rejects withdrawal — returns pending to balance
    function releaseWithdraw(address user, uint256 amount) external nonReentrant whenNotPaused onlyRole(OPERATOR_ROLE) {
        uint256 pending = pendingWithdraw[user];
        if (pending < amount) {
            revert InsufficientPending(amount, pending);
        }

        pendingWithdraw[user] = pending - amount;
        balances[user] += amount;

        emit WithdrawReleased(user, amount);
    }

    function setLimits(uint256 _minDeposit, uint256 _minWithdraw) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDeposit = _minDeposit;
        minWithdraw = _minWithdraw;
        emit LimitsUpdated(_minDeposit, _minWithdraw);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
