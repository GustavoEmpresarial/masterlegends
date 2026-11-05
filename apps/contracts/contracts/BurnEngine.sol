// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./MLLPlayerNFT.sol";

/**
 * @title BurnEngine
 * @notice Handles fusion of 5 NFTs into 1 higher rarity NFT
 */
contract BurnEngine is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    MLLPlayerNFT public immutable playerNFT;

    uint32[2][5] public overwallRanges = [
        [uint32(400), uint32(500)],
        [uint32(1000), uint32(2000)],
        [uint32(10000), uint32(12000)],
        [uint32(50000), uint32(62000)],
        [uint32(160000), uint32(173000)]
    ];

    event PlayersFused(
        address indexed owner,
        uint256[5] burnedIds,
        uint256 newTokenId,
        uint8 newRarity,
        uint32 newOverwall
    );

    error NotOwner(address caller, uint256 tokenId);
    error DifferentRarities();
    error CannotFuseLegendary();
    error InvalidTokenId(uint256 tokenId);

    constructor(address _playerNFT) {
        playerNFT = MLLPlayerNFT(_playerNFT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Fuse 5 NFTs of same rarity into 1 of higher rarity
     * @param tokenIds Array of 5 token IDs to fuse
     * @return newTokenId The ID of the newly minted NFT
     */
    function fuse(uint256[5] calldata tokenIds) external nonReentrant whenNotPaused returns (uint256) {
        // Validate all tokens
        (uint8 firstRarity,,,,,) = playerNFT.players(tokenIds[0]);
        
        if (firstRarity >= 4) {
            revert CannotFuseLegendary();
        }

        for (uint256 i = 0; i < 5; i++) {
            if (playerNFT.ownerOf(tokenIds[i]) != msg.sender) {
                revert NotOwner(msg.sender, tokenIds[i]);
            }
            (uint8 rarity,,,,,) = playerNFT.players(tokenIds[i]);
            if (rarity != firstRarity) {
                revert DifferentRarities();
            }
        }

        // Burn all 5 tokens
        for (uint256 i = 0; i < 5; i++) {
            playerNFT.burn(tokenIds[i]);
        }

        // Calculate new rarity and overwall
        uint8 newRarity = firstRarity + 1;
        uint32 newOverwall = _calculateOverwall(newRarity, block.timestamp);
        (,,,uint8 position,,) = playerNFT.players(tokenIds[0]);

        // Mint new token
        uint256 newTokenId = playerNFT.mint(
            msg.sender,
            newRarity,
            newOverwall,
            position,
            bytes32(0)
        );

        emit PlayersFused(msg.sender, tokenIds, newTokenId, newRarity, newOverwall);
        return newTokenId;
    }

    function _calculateOverwall(uint8 rarity, uint256 random) internal view returns (uint32) {
        uint32 min = overwallRanges[rarity][0];
        uint32 max = overwallRanges[rarity][1];
        uint32 range = max - min + 1;
        return min + uint32(random % range);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
