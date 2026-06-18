// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PayrollVault.sol";
import "../src/PayrollScheduler.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock USDC ───────────────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) { return 6; }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

contract PayrollVaultTest is Test {
    MockUSDC         usdc;
    PayrollVault     vault;
    PayrollScheduler scheduler;

    address owner   = address(0x0001);
    address agent   = address(0x0002);
    address alice   = address(0x1001);
    address bob     = address(0x1002);
    address carol   = address(0x1003);

    // Mock yield source addresses (not real contracts, just addresses for routing tests)
    address sourceA = address(0xA111);
    address sourceB = address(0xB222);

    uint256 constant CYCLE = 30 days;
    uint256 constant DEPOSIT_AMOUNT = 50_000 * 1e6; // $50,000 USDC
    uint256 constant ALICE_SALARY   =  5_000 * 1e6; // $5,000 USDC
    uint256 constant BOB_SALARY     =  3_500 * 1e6; // $3,500 USDC
    uint256 constant CAROL_SALARY   =  4_200 * 1e6; // $4,200 USDC

    // ─── Setup ───────────────────────────────────────────────────────────────

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy vault with agent as trusted agent
        vault = new PayrollVault(IERC20(address(usdc)), agent, owner);

        // Deploy scheduler
        scheduler = new PayrollScheduler(
            address(vault),
            address(usdc),
            agent,
            CYCLE,
            owner
        );

        // Add yield sources
        vault.addYieldSource(sourceA);
        vault.addYieldSource(sourceB);

        // Fund owner with USDC and approve vault
        usdc.mint(owner, DEPOSIT_AMOUNT * 2);
        usdc.approve(address(vault), type(uint256).max);

        vm.stopPrank();
    }

    // ─── Test: Dead shares prevent inflation attack ───────────────────────────

    function test_DeadSharesMintedOnDeploy() public view {
        // 1000 dead shares should exist at address(0xdead)
        assertEq(vault.balanceOf(address(0xdead)), 1000);
        assertEq(vault.totalSupply(), 1000);
    }

    // ─── Test: Deposit and withdraw ──────────────────────────────────────────

    function test_DepositAndWithdraw() public {
        vm.startPrank(owner);

        // Deposit $50,000 USDC
        uint256 sharesMinted = vault.deposit(DEPOSIT_AMOUNT, owner);
        assertTrue(sharesMinted > 0, "Should receive shares");
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT, "Total assets should match deposit");

        // Withdraw half
        uint256 halfShares = sharesMinted / 2;
        uint256 assetsReturned = vault.redeem(halfShares, owner, owner);
        assertTrue(assetsReturned > 0, "Should receive assets on redeem");

        vm.stopPrank();
    }

    // ─── Test: Only agent can emit memo ──────────────────────────────────────

    function test_EmitMemo_OnlyAgent() public {
        bytes32 memoHash = keccak256("test memo content");
        string memory cid = "ipfs://Qm123testcid";

        // Non-agent cannot emit memo
        vm.prank(owner);
        vm.expectRevert("PayrollVault: caller is not the trusted agent");
        vault.emitMemo(memoHash, cid);

        // Agent CAN emit memo
        vm.prank(agent);
        uint256 memoId = vault.emitMemo(memoHash, cid);
        assertEq(memoId, 0, "First memo id should be 0");
        assertEq(vault.memoCount(), 1, "Memo count should increment");
    }

    // ─── Test: Memo emitted before rebalance — event order ──────────────────

    function test_EmitMemo_EventEmitted() public {
        vm.startPrank(owner);
        vault.deposit(DEPOSIT_AMOUNT, owner);
        vm.stopPrank();

        bytes32 memoHash = keccak256("70% Source A, 30% Source B. GoPlus: clean.");
        string memory cid = "";

        vm.prank(agent);
        vm.expectEmit(true, true, false, true, address(vault));
        emit PayrollVault.CFOMemoEmitted(0, memoHash, cid, block.timestamp);

        vault.emitMemo(memoHash, cid);
    }

    // ─── Test: Rebalance allocates correctly ─────────────────────────────────

    function test_Rebalance_AllocatesCorrectly() public {
        // Deposit first
        vm.startPrank(owner);
        vault.deposit(DEPOSIT_AMOUNT, owner);
        vm.stopPrank();

        // Build allocation arrays: 70% to A, 30% to B
        address[] memory sources = new address[](2);
        uint256[] memory allocs  = new uint256[](2);
        sources[0] = sourceA; allocs[0] = 35_000 * 1e6; // 70%
        sources[1] = sourceB; allocs[1] = 15_000 * 1e6; // 30%

        vm.prank(agent);
        vault.rebalance(sources, allocs);

        assertEq(vault.getSourceBalance(sourceA), 35_000 * 1e6, "Source A balance mismatch");
        assertEq(vault.getSourceBalance(sourceB), 15_000 * 1e6, "Source B balance mismatch");
    }

    // ─── Test: Rebalance rejects unapproved source ───────────────────────────

    function test_Rebalance_RejectsUnapprovedSource() public {
        vm.startPrank(owner);
        vault.deposit(DEPOSIT_AMOUNT, owner);
        vm.stopPrank();

        address unapproved = address(0x9999);
        address[] memory sources = new address[](1);
        uint256[] memory allocs  = new uint256[](1);
        sources[0] = unapproved;
        allocs[0]  = 10_000 * 1e6;

        vm.prank(agent);
        vm.expectRevert("PayrollVault: unapproved yield source");
        vault.rebalance(sources, allocs);
    }

    // ─── Test: Rebalance enforces 80% cap ────────────────────────────────────

    function test_Rebalance_EnforcesMaxCap() public {
        vm.startPrank(owner);
        vault.deposit(DEPOSIT_AMOUNT, owner);
        vm.stopPrank();

        // Try to move 90% (45,000 out of 50,000) — should revert
        address[] memory sources = new address[](1);
        uint256[] memory allocs  = new uint256[](1);
        sources[0] = sourceA;
        allocs[0]  = 45_001 * 1e6; // just over 90%

        vm.prank(agent);
        vm.expectRevert("PayrollVault: rebalance exceeds 80% of assets");
        vault.rebalance(sources, allocs);
    }

    // ─── Test: Only agent can call rebalance ─────────────────────────────────

    function test_Rebalance_OnlyAgent() public {
        vm.startPrank(owner);
        vault.deposit(DEPOSIT_AMOUNT, owner);
        vm.stopPrank();

        address[] memory sources = new address[](1);
        uint256[] memory allocs  = new uint256[](1);
        sources[0] = sourceA;
        allocs[0]  = 10_000 * 1e6;

        vm.prank(alice);
        vm.expectRevert("PayrollVault: caller is not the trusted agent");
        vault.rebalance(sources, allocs);
    }

    // ─── Test: Scheduler addEmployee and payroll flow ────────────────────────

    function test_Scheduler_AddEmployees() public {
        vm.startPrank(owner);
        scheduler.addEmployee(alice, ALICE_SALARY);
        scheduler.addEmployee(bob,   BOB_SALARY);
        scheduler.addEmployee(carol, CAROL_SALARY);
        vm.stopPrank();

        assertEq(scheduler.employeeCount(), 3);
        assertEq(scheduler.getEmployee(0).wallet, alice);
        assertEq(scheduler.getEmployee(1).salaryAmount, BOB_SALARY);
    }

    // ─── Test: Scheduler executePayroll distributes correctly ────────────────

    function test_Scheduler_ExecutePayroll() public {
        // Setup: add employees
        vm.startPrank(owner);
        scheduler.addEmployee(alice, ALICE_SALARY);
        scheduler.addEmployee(bob,   BOB_SALARY);
        scheduler.addEmployee(carol, CAROL_SALARY);
        vm.stopPrank();

        // Agent clears security for all employees
        vm.startPrank(agent);
        scheduler.setSecurityCleared(0, true);
        scheduler.setSecurityCleared(1, true);
        scheduler.setSecurityCleared(2, true);
        vm.stopPrank();

        // Fund scheduler with USDC (simulating vault withdrawal pre-step)
        uint256 payrollAmount = ALICE_SALARY + BOB_SALARY + CAROL_SALARY;
        usdc.mint(address(scheduler), payrollAmount);

        // Advance time past payday
        vm.warp(block.timestamp + CYCLE + 1);

        // Record balances before
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);
        uint256 carolBefore = usdc.balanceOf(carol);

        // Execute payroll
        vm.prank(agent);
        scheduler.executePayroll();

        // Verify all employees received correct amounts
        assertEq(usdc.balanceOf(alice) - aliceBefore, ALICE_SALARY, "Alice salary mismatch");
        assertEq(usdc.balanceOf(bob)   - bobBefore,   BOB_SALARY,   "Bob salary mismatch");
        assertEq(usdc.balanceOf(carol) - carolBefore, CAROL_SALARY, "Carol salary mismatch");
    }

    // ─── Test: Payroll skips flagged employees ────────────────────────────────

    function test_Scheduler_SkipsUnclearedEmployees() public {
        vm.startPrank(owner);
        scheduler.addEmployee(alice, ALICE_SALARY);
        scheduler.addEmployee(bob,   BOB_SALARY);
        vm.stopPrank();

        // Only Alice is security-cleared; Bob is not
        vm.prank(agent);
        scheduler.setSecurityCleared(0, true);
        // Bob stays un-cleared (default false)

        uint256 payrollFunds = ALICE_SALARY + BOB_SALARY;
        usdc.mint(address(scheduler), payrollFunds);

        vm.warp(block.timestamp + CYCLE + 1);

        vm.prank(agent);
        scheduler.executePayroll();

        // Alice paid, Bob NOT paid
        assertEq(usdc.balanceOf(alice), ALICE_SALARY, "Alice should be paid");
        assertEq(usdc.balanceOf(bob),   0,            "Bob should be skipped");
    }

    // ─── Test: Payroll reverts if payday not due ─────────────────────────────

    function test_Scheduler_RevertIfNotPayday() public {
        vm.prank(agent);
        vm.expectRevert("PayrollScheduler: payday not yet due");
        scheduler.executePayroll();
    }

    // ─── Test: setAgent rotation ─────────────────────────────────────────────

    function test_SetAgent_Rotation() public {
        address newAgent = address(0x9999);

        vm.prank(owner);
        vault.setAgent(newAgent);

        assertEq(vault.trustedAgent(), newAgent);

        // Old agent can no longer call rebalance
        address[] memory sources = new address[](1);
        uint256[] memory allocs  = new uint256[](1);
        sources[0] = sourceA; allocs[0] = 1_000 * 1e6;

        vm.prank(agent);
        vm.expectRevert("PayrollVault: caller is not the trusted agent");
        vault.rebalance(sources, allocs);
    }
}
