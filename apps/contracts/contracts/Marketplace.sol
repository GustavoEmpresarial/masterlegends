// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MLLPlayerNFT.sol";

/**
 * @title Marketplace
 * @notice Order book marketplace for NFT trading in USDC
 */
contract Marketplace is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    MLLPlayerNFT public immutable playerNFT;
    IERC20 public immutable usdcToken;
    address public rewardsPool;

    uint256 public constant FEE_BPS = 200; // 2%
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Price validation ranges by rarity [min, max] in USDC (6 decimals)
    uint256[2][4] public priceRanges = [
        [uint256(35 * 1e6), uint256(45 * 1e6)],
        [uint256(180 * 1e6), uint256(225 * 1e6)],
        [uint256(900 * 1e6), uint256(1150 * 1e6)],
        [uint256(5000 * 1e6), uint256(6000 * 1e6)]
    ];

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;

    event ItemListed(uint256 indexed listingId, uint256 indexed tokenId, address seller, uint256 price);
    event ItemSold(uint256 indexed listingId, uint256 indexed tokenId, address buyer, uint256 price, uint256 fee);
    event ListingCancelled(uint256 indexed listingId);

    error NotOwner(address caller, uint256 tokenId);
    error CommonNotTradeable();
    error PriceOutOfRange(uint256 price, uint256 min, uint256 max);
    error ListingNotActive(uint256 listingId);
    error NotSeller(address caller, address seller);

    constructor(address _playerNFT, address _usdcToken, address _rewardsPool) {
        playerNFT = MLLPlayerNFT(_playerNFT);
        usdcToken = IERC20(_usdcToken);
        rewardsPool = _rewardsPool;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice List an NFT for sale
     * @param tokenId The NFT to list
     * @param price Price in USDC
     */
    function listItem(uint256 tokenId, uint256 price) external whenNotPaused {
        if (playerNFT.ownerOf(tokenId) != msg.sender) {
            revert NotOwner(msg.sender, tokenId);
        }

        (uint8 rarity,,,,,) = playerNFT.players(tokenId);
        if (rarity < 1) {
            revert CommonNotTradeable();
        }

        // Validate price range
        uint256 minPrice = priceRanges[rarity - 1][0];
        uint256 maxPrice = priceRanges[rarity - 1][1];
        if (price < minPrice || price > maxPrice) {
            revert PriceOutOfRange(price, minPrice, maxPrice);
        }

        // Transfer NFT to contract
        playerNFT.transferFrom(msg.sender, address(this), tokenId);

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit ItemListed(listingId, tokenId, msg.sender, price);
    }

    /**
     * @notice Buy a listed NFT
     * @param listingId The listing to buy
     */
    function buyItem(uint256 listingId) external nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        if (!listing.active) {
            revert ListingNotActive(listingId);
        }

        uint256 fee = (listing.price * FEE_BPS) / FEE_DENOMINATOR;
        uint256 sellerAmount = listing.price - fee;

        // Transfer USDC from buyer
        usdcToken.safeTransferFrom(msg.sender, address(this), listing.price);

        // Transfer fee to rewards pool
        usdcToken.safeTransfer(rewardsPool, fee);

        // Transfer payment to seller
        usdcToken.safeTransfer(listing.seller, sellerAmount);

        // Transfer NFT to buyer
        playerNFT.transferFrom(address(this), msg.sender, listing.tokenId);

        listing.active = false;

        emit ItemSold(listingId, listing.tokenId, msg.sender, listing.price, fee);
    }

    /**
     * @notice Cancel a listing
     * @param listingId The listing to cancel
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (listing.seller != msg.sender) {
            revert NotSeller(msg.sender, listing.seller);
        }
        if (!listing.active) {
            revert ListingNotActive(listingId);
        }

        // Return NFT to seller
        playerNFT.transferFrom(address(this), msg.sender, listing.tokenId);

        listing.active = false;

        emit ListingCancelled(listingId);
    }

    /**
     * @notice Get active listings
     * @param offset Pagination offset
     * @param limit Pagination limit
     * @return ids Array of listing IDs
     */
    function getActiveListings(uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 count = 0;
        uint256[] memory temp = new uint256[](nextListingId);

        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) {
                if (count >= offset && count < offset + limit) {
                    temp[count - offset] = i;
                }
                count++;
            }
        }

        ids = new uint256[](Math.min(limit, count - offset));
        for (uint256 i = 0; i < ids.length; i++) {
            ids[i] = temp[i];
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Helper function
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
