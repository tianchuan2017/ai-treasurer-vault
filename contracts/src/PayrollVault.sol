// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PayrollVault
 * @notice ERC-4626 yield vault for idle payroll USDC.
 *
 * Key design points:
 *  - Dead shares (1000 minted to 0xdead in constructor) prevent the first-depositor
 *    inflation attack. Required to pass CertiK audit.
 *  - Only the trustedAgent address may call rebalance() — limits attack surface.
 *  - emitMemo() is called BY the agent BEFORE rebalance(), creating an immutable
 *    on-chain record of the AI's reasoning. This is the differentiator.
 *  - totalAssets() is overridden to aggregate across multiple yield sources.
 *    For the demo, yield source balances are tracked internally (no live DEX).
 *    In production, replace _getSourceBalance() with real ERC-4626 vault reads.
 */
contract PayrollVault is ERC4626, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── State ──────────────────────────────────────────────────────────────

    /// @notice The AI agent address — only this address may rebalance.
    address public trustedAgent;

    /// @notice Pre-approved yield source addresses (e.g., Aave, Morpho adapters).
    address[] public yieldSources;

    /// @notice Tracks how much USDC is deployed in each yield source.
    mapping(address => uint256) public sourceBalance;

    /// @notice Memo counter — incremented each time a memo is emitted.
    uint256 public memoCount;

    /// @notice Maximum fraction of total assets that can be rebalanced in one call (80%).
    uint256 public constant MAX_REBALANCE_BPS = 8000; // basis points

    // ─── Events ─────────────────────────────────────────────────────────────

    /**
     * @notice Emitted before every rebalance. The memoHash is keccak256 of the
     *         full memo text. ipfsCid stores the human-readable memo for the UI.
     *         Both are immutable — this is the CFO audit trail.
     */
    event CFOMemoEmitted(
        uint256 indexed memoId,
        bytes32 indexed memoHash,
        string  ipfsCid,
        uint256 timestamp
    );

    /// @notice Emitted after each successful rebalance.
    event Rebalanced(
        uint256 indexed memoId,
        address[] sources,
        uint256[] allocations,
        uint256   totalMoved
    );

    /// @notice Emitted when the trusted agent address changes.
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    /// @notice Emitted when a yield source is added or removed.
    event YieldSourceAdded(address indexed source);
    event YieldSourceRemoved(address indexed source);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param asset_      The ERC-20 token used as the vault asset (USDC).
     * @param agent_      The trusted AI agent address.
     * @param initialOwner The vault owner (CFO / multisig).
     */
    constructor(
        IERC20 asset_,
        address agent_,
        address initialOwner
    )
        ERC20("AI-Treasurer Vault USDC", "aitUSDC")
        ERC4626(asset_)
        Ownable(initialOwner)
    {
        require(agent_ != address(0), "PayrollVault: zero agent address");

        trustedAgent = agent_;

        // ── Inflation-attack mitigation ───────────────────────────────────
        // Mint 1000 dead shares to the zero address. This ensures the initial
        // share price is non-trivial, preventing an attacker from donating 1 wei
        // to manipulate the share price against the first real depositor.
        // Reference: OZ ERC4626 docs, CertiK ERC-4626 findings.
        _mint(address(0xdead), 1000);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyAgent() {
        require(msg.sender == trustedAgent, "PayrollVault: caller is not the trusted agent");
        _;
    }

    // ─── Agent Actions ───────────────────────────────────────────────────────

    /**
     * @notice Record the AI-generated CFO memo on-chain BEFORE executing a rebalance.
     *         The frontend reads these events to display the memo in the dashboard.
     *
     * @param memoHash  keccak256 of the full memo text (integrity anchor).
     * @param ipfsCid   IPFS CID or calldata string with the human-readable memo.
     *
     * NOTE: The agent MUST call emitMemo() in a transaction that confirms before
     *       calling rebalance(). The UI enforces this ordering in the demo.
     */
    function emitMemo(bytes32 memoHash, string calldata ipfsCid)
        external
        onlyAgent
        returns (uint256 memoId)
    {
        memoId = memoCount++;
        emit CFOMemoEmitted(memoId, memoHash, ipfsCid, block.timestamp);
    }

    /**
     * @notice Rebalance idle USDC across pre-approved yield sources.
     *         Only the trusted AI agent may call this.
     *
     * @param sources     Array of yield source addresses (must all be approved).
     * @param allocations Array of USDC amounts to deploy to each source.
     *
     * For the demo: allocations move funds between internal sourceBalance buckets.
     * In production: replace the body with real ERC-4626 vault deposit/withdraw calls.
     */
    function rebalance(
        address[] calldata sources,
        uint256[] calldata allocations
    )
        external
        nonReentrant
        onlyAgent
    {
        require(sources.length == allocations.length, "PayrollVault: length mismatch");
        require(sources.length > 0, "PayrollVault: empty rebalance");

        uint256 total = totalAssets();
        uint256 moving = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            moving += allocations[i];
        }

        // Enforce maximum rebalance fraction to prevent draining the vault.
        require(
            moving <= (total * MAX_REBALANCE_BPS) / 10_000,
            "PayrollVault: rebalance exceeds 80% of assets"
        );

        // Verify all sources are approved.
        for (uint256 i = 0; i < sources.length; i++) {
            require(_isApprovedSource(sources[i]), "PayrollVault: unapproved yield source");
        }

        // Reset all source balances and reassign per new allocations.
        // (In production: withdraw from old sources, deposit into new ones.)
        for (uint256 i = 0; i < yieldSources.length; i++) {
            sourceBalance[yieldSources[i]] = 0;
        }
        for (uint256 i = 0; i < sources.length; i++) {
            sourceBalance[sources[i]] = allocations[i];
        }

        emit Rebalanced(memoCount > 0 ? memoCount - 1 : 0, sources, allocations, moving);
    }

    // ─── ERC-4626 Overrides ──────────────────────────────────────────────────

    /**
     * @notice Returns the total USDC managed by this vault.
     *         Sums idle balance + all yield source balances.
     */
    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 deployed = 0;
        for (uint256 i = 0; i < yieldSources.length; i++) {
            deployed += sourceBalance[yieldSources[i]];
        }
        return idle + deployed;
    }

    // ─── Owner Administration ────────────────────────────────────────────────

    /// @notice Update the trusted AI agent address (e.g., after key rotation).
    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "PayrollVault: zero agent address");
        emit AgentUpdated(trustedAgent, newAgent);
        trustedAgent = newAgent;
    }

    /// @notice Add a yield source to the approved list.
    function addYieldSource(address source) external onlyOwner {
        require(source != address(0), "PayrollVault: zero source");
        require(!_isApprovedSource(source), "PayrollVault: already approved");
        yieldSources.push(source);
        emit YieldSourceAdded(source);
    }

    /// @notice Remove a yield source from the approved list.
    function removeYieldSource(address source) external onlyOwner {
        require(sourceBalance[source] == 0, "PayrollVault: source has balance");
        for (uint256 i = 0; i < yieldSources.length; i++) {
            if (yieldSources[i] == source) {
                yieldSources[i] = yieldSources[yieldSources.length - 1];
                yieldSources.pop();
                emit YieldSourceRemoved(source);
                return;
            }
        }
        revert("PayrollVault: source not found");
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    /// @notice Return all approved yield sources.
    function getYieldSources() external view returns (address[] memory) {
        return yieldSources;
    }

    /// @notice Return the balance allocated to a specific source.
    function getSourceBalance(address source) external view returns (uint256) {
        return sourceBalance[source];
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _isApprovedSource(address source) internal view returns (bool) {
        for (uint256 i = 0; i < yieldSources.length; i++) {
            if (yieldSources[i] == source) return true;
        }
        return false;
    }
}
