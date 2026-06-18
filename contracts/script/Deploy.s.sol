// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PayrollVault.sol";
import "../src/PayrollScheduler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Deploy
 * @notice Deploys PayrollVault + PayrollScheduler to Base Sepolia (or mainnet).
 *
 * Usage:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url https://sepolia.base.org \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 */
contract Deploy is Script {
    // Base Sepolia USDC
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Base Mainnet USDC
    address constant USDC_BASE_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // 30-day pay cycle in seconds
    uint256 constant CYCLE_LENGTH = 30 days;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address agentAddress = vm.envOr("AGENT_ADDRESS", deployer); // default: deployer is agent for testing

        // Pick USDC address based on chain
        address usdcAddress = block.chainid == 8453
            ? USDC_BASE_MAINNET
            : USDC_BASE_SEPOLIA;

        console.log("=== AI-Treasurer Payroll Vault Deploy ===");
        console.log("Deployer:      ", deployer);
        console.log("Agent address: ", agentAddress);
        console.log("USDC address:  ", usdcAddress);
        console.log("Chain ID:      ", block.chainid);
        console.log("Cycle length:  ", CYCLE_LENGTH, "seconds");
        console.log("=========================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PayrollVault
        PayrollVault vault = new PayrollVault(
            IERC20(usdcAddress),
            agentAddress,
            deployer     // owner = deployer (CFO / multisig in production)
        );

        console.log("PayrollVault deployed at:", address(vault));

        // 2. Deploy PayrollScheduler (references the vault)
        PayrollScheduler scheduler = new PayrollScheduler(
            address(vault),
            usdcAddress,
            agentAddress,
            CYCLE_LENGTH,
            deployer     // owner
        );

        console.log("PayrollScheduler deployed at:", address(scheduler));

        // 3. Add scheduler as an approved caller on the vault
        //    (in this demo the agent wallet directly calls the vault,
        //     but if the scheduler needs to call rebalance in future, add it here)
        // vault.setAgent(address(scheduler)); // uncomment to route through scheduler

        // 4. Add two mock yield sources for the demo
        //    (placeholder addresses — in production these are real ERC-4626 vault addresses)
        address mockSourceA = address(0xA11CE0000000000000000000000000000000000A);
        address mockSourceB = address(0xB0B0000000000000000000000000000000000B0B);
        vault.addYieldSource(mockSourceA);
        vault.addYieldSource(mockSourceB);

        console.log("Yield source A added:", mockSourceA);
        console.log("Yield source B added:", mockSourceB);

        vm.stopBroadcast();

        console.log("");
        console.log("=== NEXT STEPS ===");
        console.log("1. Copy these addresses into your .env:");
        console.log("   PAYROLL_VAULT_ADDRESS=", address(vault));
        console.log("   PAYROLL_SCHEDULER_ADDRESS=", address(scheduler));
        console.log("2. Approve USDC spend for the vault:");
        console.log("   cast send", usdcAddress, "\"approve(address,uint256)\"", address(vault), "50000000000");
        console.log("3. Deposit USDC:");
        console.log("   cast send", address(vault), "\"deposit(uint256,address)\"", "50000000000", deployer);
        console.log("4. Add employees via PayrollScheduler.addEmployee()");
        console.log("5. Run agent: cd ../agent && npm run agent:cycle");
    }
}
