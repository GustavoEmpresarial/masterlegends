// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MLLPlayerNFT.sol";

/**
 * @title ScoutEngine
 * @notice Handles NFT minting with Chainlink VRF randomness
 */
contract ScoutEngine is VRFConsumerBaseV2, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    VRFCoordinatorV2Interface public immutable COORDINATOR;

    bytes32 public constant VRF_ROLE = keccak256("VRF_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint64 public immutable subscriptionId;
    bytes32 public immutable keyHash;
    uint32 public constant CALLBACK_GAS_LIMIT = 500_000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    uint256 public constant MINT_PRICE = 10 * 1e6; // 10 USDC (6 decimals)

    IERC20 public immutable usdcToken;
    MLLPlayerNFT public immutable playerNFT;

    // Revenue distribution addresses
    address public rewardsPool;
    address public devOps;
    address public marketing;
    address public liquidity;
    address public reserve;

    // Rarity chances in basis points (total = 10000)
    uint256[5] public rarityChances = [8482, 1500, 15, 2, 1];

    // Overwall ranges by rarity [min, max]
    uint32[2][5] public overwallRanges = [
        [uint32(400), uint32(500)],
        [uint32(1000), uint32(2000)],
        [uint32(10000), uint32(12000)],
        [uint32(50000), uint32(62000)],
        [uint32(160000), uint32(173000)]
    ];

    struct MintRequest {
        address to;
        uint256 quantity;
        uint256 timestamp;
    }

    mapping(uint256 => MintRequest) public mintRequests;

    event MintRequested(uint256 indexed requestId, address indexed to, uint256 quantity);
    event PlayerMinted(
        address indexed to,
        uint256 tokenId,
        uint8 rarity,
        uint32 overwall,
        uint8 position
    );
    event RevenueDistributed(
        uint256 rewards,
        uint256 devOps,
        uint256 marketing,
        uint256 liquidity,
        uint256 reserve
    );

    error InvalidQuantity(uint8 quantity);
    error InvalidRequest(uint256 requestId);

    constructor(
        address vrfCoordinator,
        uint64 _subscriptionId,
        bytes32 _keyHash,
        address _usdcToken,
        address _playerNFT,
        address _rewardsPool,
        address _devOps,
        address _marketing,
        address _liquidity,
        address _reserve
    ) VRFConsumerBaseV2(vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        usdcToken = IERC20(_usdcToken);
        playerNFT = MLLPlayerNFT(_playerNFT);

        rewardsPool = _rewardsPool;
        devOps = _devOps;
        marketing = _marketing;
        liquidity = _liquidity;
        reserve = _reserve;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VRF_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Request to mint NFTs
     * @param quantity Number of NFTs to mint (1-10)
     */
    function requestMint(uint8 quantity) external nonReentrant whenNotPaused {
        if (quantity == 0 || quantity > 10) {
            revert InvalidQuantity(quantity);
        }

        uint256 totalCost = uint256(quantity) * MINT_PRICE;

        // Transfer USDC from user
        usdcToken.safeTransferFrom(msg.sender, address(this), totalCost);

        // Distribute revenue
        _distributeRevenue(totalCost);

        // Request randomness from Chainlink VRF
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );

        mintRequests[requestId] = MintRequest({
            to: msg.sender,
            quantity: quantity,
            timestamp: block.timestamp
        });

        emit MintRequested(requestId, msg.sender, quantity);
    }

    /**
     * @notice Callback from Chainlink VRF
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        MintRequest memory request = mintRequests[requestId];
        if (request.to == address(0)) {
            revert InvalidRequest(requestId);
        }

        uint256 randomSeed = randomWords[0];

        for (uint256 i = 0; i < request.quantity; i++) {
            uint8 rarity = _calculateRarity(randomSeed, i);
            uint32 overwall = _calculateOverwall(rarity, randomSeed, i + 1000);
            uint8 position = uint8((randomSeed + i) % 4);

            uint256 tokenId = playerNFT.mint(
                request.to,
                rarity,
                overwall,
                position,
                bytes32(0)
            );

            emit PlayerMinted(request.to, tokenId, rarity, overwall, position);
        }

        delete mintRequests[requestId];
    }

    function _calculateRarity(uint256 seed, uint256 index) internal view returns (uint8) {
        uint256 chance = (seed + index) % 10000;
        uint256 cumulative = 0;

        for (uint8 i = 0; i < 5; i++) {
            cumulative += rarityChances[i];
            if (chance < cumulative) {
                return i;
            }
        }
        return 0;
    }

    function _calculateOverwall(
        uint8 rarity,
        uint256 seed,
        uint256 offset
    ) internal view returns (uint32) {
        uint32 min = overwallRanges[rarity][0];
        uint32 max = overwallRanges[rarity][1];
        uint32 range = max - min + 1;
        return min + uint32((seed + offset) % range);
    }

    function _distributeRevenue(uint256 amount) internal {
        uint256 rewardsAmount = (amount * 61) / 100;
        uint256 devOpsAmount = (amount * 18) / 100;
        uint256 marketingAmount = (amount * 13) / 100;
        uint256 liquidityAmount = (amount * 4) / 100;
        uint256 reserveAmount = amount - rewardsAmount - devOpsAmount - marketingAmount - liquidityAmount;

        usdcToken.safeTransfer(rewardsPool, rewardsAmount);
        usdcToken.safeTransfer(devOps, devOpsAmount);
        usdcToken.safeTransfer(marketing, marketingAmount);
        usdcToken.safeTransfer(liquidity, liquidityAmount);
        usdcToken.safeTransfer(reserve, reserveAmount);

        emit RevenueDistributed(rewardsAmount, devOpsAmount, marketingAmount, liquidityAmount, reserveAmount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
