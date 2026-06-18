// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PayrollVault.sol";

/**
 * @title PayrollScheduler
 * @notice Manages the employee salary registry and executes periodic payroll
 *         distributions from the PayrollVault.
 *
 * Design notes:
 *  - The Scheduler is also the "trustedAgent" for PayrollVault in the deploy script,
 *    so it can call vault.rebalance() and vault.emitMemo() on behalf of the agent.
 *    In the full system, the off-chain AI agent calls these via walletClient directly.
 *  - GoPlus security check is enforced off-chain by the agent BEFORE calling
 *    executePayroll(). The scheduler tracks a per-employee `securityCleared` flag
 *    that the agent sets after a successful GoPlus check.
 *  - Payday cadence is tracked via `cycleLength` and `lastPayday` timestamps.
 */
contract PayrollScheduler is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Employee {
        address wallet;
        uint256 salaryAmount;   // USDC amount per cycle (6 decimals)
        bool    active;
        bool    securityCleared; // set by agent after GoPlus check
        uint256 lastPaid;       // timestamp of last payment
    }

    // ─── State ────────────────────────────────────────────────────────────────

    PayrollVault public immutable vault;
    IERC20       public immutable usdc;

    /// @notice Duration of one pay cycle in seconds (default: 30 days).
    uint256 public cycleLength;

    /// @notice Timestamp of the last executed payroll.
    uint256 public lastPayday;

    /// @notice The AI agent address — can execute payroll and update security flags.
    address public trustedAgent;

    /// @notice Employee registry.
    Employee[] public employees;

    // ─── Events ───────────────────────────────────────────────────────────────

    event EmployeeAdded(uint256 indexed id, address indexed wallet, uint256 salaryAmount);
    event EmployeeRemoved(uint256 indexed id, address indexed wallet);
    event SecurityCleared(uint256 indexed id, address indexed wallet, bool cleared);
    event PayrollExecuted(uint256 indexed cycleNumber, uint256 totalDistributed, uint256 employeesCount);
    event SalaryPaid(uint256 indexed employeeId, address indexed wallet, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param vault_        Address of the PayrollVault.
     * @param usdc_         Address of the USDC token.
     * @param agent_        The trusted AI agent address.
     * @param cycleLength_  Pay cycle in seconds (e.g., 30 * 86400 for 30 days).
     * @param initialOwner  The contract owner.
     */
    constructor(
        address vault_,
        address usdc_,
        address agent_,
        uint256 cycleLength_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(vault_ != address(0), "PayrollScheduler: zero vault");
        require(usdc_  != address(0), "PayrollScheduler: zero usdc");
        require(agent_ != address(0), "PayrollScheduler: zero agent");
        require(cycleLength_ > 0,     "PayrollScheduler: zero cycle");

        vault        = PayrollVault(vault_);
        usdc         = IERC20(usdc_);
        trustedAgent = agent_;
        cycleLength  = cycleLength_;
        lastPayday   = block.timestamp;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAgent() {
        require(msg.sender == trustedAgent, "PayrollScheduler: not agent");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(
            msg.sender == trustedAgent || msg.sender == owner(),
            "PayrollScheduler: not agent or owner"
        );
        _;
    }

    // ─── Employee Registry ───────────────────────────────────────────────────

    /**
     * @notice Add an employee to the payroll.
     * @param wallet        Employee's USDC-receiving address.
     * @param salaryAmount  USDC amount per cycle (e.g., 5000 * 1e6 for $5,000).
     */
    function addEmployee(address wallet, uint256 salaryAmount) external onlyOwner returns (uint256 id) {
        require(wallet != address(0), "PayrollScheduler: zero wallet");
        require(salaryAmount > 0,     "PayrollScheduler: zero salary");

        id = employees.length;
        employees.push(Employee({
            wallet:          wallet,
            salaryAmount:    salaryAmount,
            active:          true,
            securityCleared: false,
            lastPaid:        0
        }));

        emit EmployeeAdded(id, wallet, salaryAmount);
    }

    /// @notice Deactivate an employee (does not delete, preserves history).
    function removeEmployee(uint256 id) external onlyOwner {
        require(id < employees.length, "PayrollScheduler: invalid id");
        employees[id].active = false;
        emit EmployeeRemoved(id, employees[id].wallet);
    }

    /**
     * @notice The agent calls this AFTER a successful GoPlus security check,
     *         marking the employee address as safe to receive funds.
     */
    function setSecurityCleared(uint256 id, bool cleared) external onlyAgent {
        require(id < employees.length, "PayrollScheduler: invalid id");
        employees[id].securityCleared = cleared;
        emit SecurityCleared(id, employees[id].wallet, cleared);
    }

    // ─── Payroll Execution ───────────────────────────────────────────────────

    /**
     * @notice Returns true if the current time is at or past the next scheduled payday.
     */
    function isPaydayDue() public view returns (bool) {
        return block.timestamp >= lastPayday + cycleLength;
    }

    /**
     * @notice Returns the timestamp of the next scheduled payday.
     */
    function nextPayday() external view returns (uint256) {
        return lastPayday + cycleLength;
    }

    /**
     * @notice Execute the payroll cycle. Called by the AI agent after:
     *         1. Running GoPlus checks (setSecurityCleared per employee)
     *         2. Withdrawing from the vault (vault.redeem or vault.withdraw)
     *
     *         The function distributes USDC directly from this contract's balance,
     *         which the agent funds by redeeming vault shares first.
     *
     *         NOTE: Employees whose securityCleared == false are SKIPPED (not reverted)
     *         to prevent a single malicious address from blocking the entire payroll.
     */
    function executePayroll() external nonReentrant onlyAgent {
        require(isPaydayDue(), "PayrollScheduler: payday not yet due");

        uint256 distributed = 0;
        uint256 paidCount   = 0;

        // Compute cycle number BEFORE updating lastPayday.
        uint256 cycleNumber = (block.timestamp - lastPayday) / cycleLength;

        for (uint256 i = 0; i < employees.length; i++) {
            Employee storage emp = employees[i];

            if (!emp.active)          continue;
            if (!emp.securityCleared) continue; // GoPlus flag — skip silently

            uint256 balance = usdc.balanceOf(address(this));
            if (balance < emp.salaryAmount) break; // insufficient funds — stop

            usdc.safeTransfer(emp.wallet, emp.salaryAmount);
            emp.lastPaid = block.timestamp;

            distributed += emp.salaryAmount;
            paidCount++;

            emit SalaryPaid(i, emp.wallet, emp.salaryAmount);
        }

        lastPayday = block.timestamp;

        emit PayrollExecuted(
            cycleNumber,
            distributed,
            paidCount
        );
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    /// @notice Returns the total USDC required for a full payroll run.
    function totalPayrollAmount() external view returns (uint256 total) {
        for (uint256 i = 0; i < employees.length; i++) {
            if (employees[i].active) {
                total += employees[i].salaryAmount;
            }
        }
    }

    /// @notice Returns number of employees.
    function employeeCount() external view returns (uint256) {
        return employees.length;
    }

    /// @notice Returns employee details by id.
    function getEmployee(uint256 id) external view returns (Employee memory) {
        require(id < employees.length, "PayrollScheduler: invalid id");
        return employees[id];
    }

    // ─── Owner Administration ────────────────────────────────────────────────

    /// @notice Rotate the trusted agent address.
    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "PayrollScheduler: zero agent");
        trustedAgent = newAgent;
    }

    /// @notice Update the payroll cycle length.
    function setCycleLength(uint256 newCycleLength) external onlyOwner {
        require(newCycleLength > 0, "PayrollScheduler: zero cycle");
        cycleLength = newCycleLength;
    }

    /**
     * @notice Emergency withdrawal of stuck USDC (e.g., after a cancelled payroll cycle).
     *         Only callable by owner.
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "PayrollScheduler: zero recipient");
        usdc.safeTransfer(to, amount);
    }
}
