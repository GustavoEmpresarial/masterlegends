// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MLLPlayerNFT
 * @notice ERC-721 NFT representing athletes in Master Legends League
 */
contract MLLPlayerNFT is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint8 public constant RARITY_COMMON = 0;
    uint8 public constant RARITY_RARE = 1;
    uint8 public constant RARITY_SUPER_RARE = 2;
    uint8 public constant RARITY_EPIC = 3;
    uint8 public constant RARITY_LEGENDARY = 4;

    uint8 public constant POSITION_GK = 0;
    uint8 public constant POSITION_ZAG = 1;
    uint8 public constant POSITION_MEI = 2;
    uint8 public constant POSITION_ATA = 3;

    struct PlayerData {
        uint8 rarity;
        uint32 overwall;
        uint8 stamina;
        uint8 position;
        uint64 mintedAt;
        bytes32 traitsHash;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => PlayerData) public players;
    mapping(address => uint256) public clubBalance;
    uint256 public constant MAX_PER_CLUB = 100;

    event PlayerMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 rarity,
        uint32 overwall,
        uint8 position
    );
    event PlayerBurned(uint256 indexed tokenId);
    event StaminaUpdated(uint256 indexed tokenId, uint8 oldStamina, uint8 newStamina);
    event TraitsHashUpdated(uint256 indexed tokenId, bytes32 newTraitsHash);

    error ClubFull(address club, uint256 current, uint256 max);
    error InvalidStamina(uint8 stamina);
    error TokenNotExists(uint256 tokenId);

    constructor() ERC721("Master Legends Player", "MLLP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(GAME_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @notice Mint a new player NFT
     * @param to The address to mint to
     * @param rarity The rarity level (0-4)
     * @param overwall The overwall rating
     * @param position The position (0-3)
     * @param traitsHash IPFS hash of special traits
     * @return tokenId The minted token ID
     */
    function mint(
        address to,
        uint8 rarity,
        uint32 overwall,
        uint8 position,
        bytes32 traitsHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        if (clubBalance[to] >= MAX_PER_CLUB) {
            revert ClubFull(to, clubBalance[to], MAX_PER_CLUB);
        }

        uint256 tokenId = _nextTokenId++;

        players[tokenId] = PlayerData({
            rarity: rarity,
            overwall: overwall,
            stamina: 100,
            position: position,
            mintedAt: uint64(block.timestamp),
            traitsHash: traitsHash
        });

        _safeMint(to, tokenId);
        clubBalance[to]++;

        emit PlayerMinted(tokenId, to, rarity, overwall, position);
        return tokenId;
    }

    /**
     * @notice Burn a player NFT
     * @param tokenId The token to burn
     */
    function burn(uint256 tokenId) external onlyRole(BURNER_ROLE) nonReentrant {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenNotExists(tokenId);
        }

        address owner = ownerOf(tokenId);
        delete players[tokenId];
        clubBalance[owner]--;

        _burn(tokenId);
        emit PlayerBurned(tokenId);
    }

    /**
     * @notice Update player stamina
     * @param tokenId The token to update
     * @param newStamina The new stamina value (0-100)
     */
    function updateStamina(uint256 tokenId, uint8 newStamina) external onlyRole(GAME_ROLE) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenNotExists(tokenId);
        }
        if (newStamina > 100) {
            revert InvalidStamina(newStamina);
        }

        uint8 oldStamina = players[tokenId].stamina;
        players[tokenId].stamina = newStamina;
        emit StaminaUpdated(tokenId, oldStamina, newStamina);
    }

    /**
     * @notice Update traits hash (metadata pointer)
     * @param tokenId The token to update
     * @param newTraitsHash The new IPFS hash
     */
    function setTraitsHash(uint256 tokenId, bytes32 newTraitsHash) external onlyRole(GAME_ROLE) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenNotExists(tokenId);
        }
        players[tokenId].traitsHash = newTraitsHash;
        emit TraitsHashUpdated(tokenId, newTraitsHash);
    }

    /**
     * @notice Get player data
     * @param tokenId The token ID
     * @return The player data struct
     */
    function getPlayer(uint256 tokenId) external view returns (PlayerData memory) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenNotExists(tokenId);
        }
        return players[tokenId];
    }

    /**
     * @notice Get effective overwall considering stamina
     * @param tokenId The token ID
     * @return The effective overwall
     */
    function getEffectiveOverwall(uint256 tokenId) external view returns (uint32) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenNotExists(tokenId);
        }
        PlayerData memory player = players[tokenId];
        return (uint32(player.overwall) * uint32(player.stamina)) / 100;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
}
