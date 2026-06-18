# Architecture — AI-Treasurer Payroll Vault

## Component Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                     User Interface Layer                          │
│                                                                   │
│  app/  (Next.js 14 App Router)                                    │
│  ├── Dashboard: vault stats, yield earned, next payday            │
│  ├── CFO Memo Feed: AI memos rendered from on-chain IPFS CIDs    │
│  ├── Employee Table: addresses, salary amounts, confirmation      │
│  └── Onboarding: Privy embedded wallet (email/SMS, no seed)      │
│                                                                   │
│  Tech: wagmi v2 useReadContract/useWriteContract, TailwindCSS    │
└──────────────────────────┬────────────────────────────────────────┘
                           │ JSON-RPC (viem)
┌──────────────────────────▼────────────────────────────────────────┐
│                       Blockchain Layer                            │
│                                                                   │
│  Base Sepolia (chainId 84532) / Base Mainnet (chainId 8453)      │
│                                                                   │
│  contracts/src/PayrollVault.sol                                   │
│  ├── Extends: OpenZeppelin ERC4626 + ReentrancyGuard              │
│  ├── Dead shares: constructor mints 1000 shares to 0xdead         │
│  │   → prevents first-depositor inflation attack (CertiK flag)   │
│  ├── rebalance(protocols[], allocations[])                        │
│  │   → onlyAgent modifier → moves USDC across yield sources      │
│  ├── emitMemo(bytes32 memoHash, string ipfsCid)                  │
│  │   → stores memo reference on-chain before rebalance           │
│  └── totalAssets() override → sums across all deployed protocols │
│                                                                   │
│  contracts/src/PayrollScheduler.sol                               │
│  ├── addEmployee(address, uint256 amount) → onlyOwner             │
│  ├── executePayroll() → withdraws from vault, distributes        │
│  │   → hardcoded payday cycle (e.g., every 30 days)              │
│  └── GoPlus pre-flight check result stored per employee          │
└──────────────────────────▲────────────────────────────────────────┘
                           │ writeContract (viem walletClient)
┌──────────────────────────┴────────────────────────────────────────┐
│                        AI Agent Layer                             │
│                                                                   │
│  agent/src/agent.ts  (Node.js, TypeScript)                        │
│                                                                   │
│  PERCEIVE                                                         │
│  ├── Read vault state via viem publicClient.readContract()        │
│  ├── Call x402-gated yield data server → auto-pays $0.001 USDC  │
│  └── Read GoPlus address_security for each employee              │
│                                                                   │
│  REASON                                                           │
│  ├── Build context: {vaultBalance, yields, gasCost, employees}    │
│  ├── Call Anthropic claude-sonnet-4-6 with CFO memo prompt        │
│  └── Parse response: {allocation, memo, confidence}               │
│                                                                   │
│  ACT                                                              │
│  ├── Pin memo to IPFS (or emit directly as calldata)              │
│  ├── walletClient.writeContract → PayrollVault.emitMemo()         │
│  └── walletClient.writeContract → PayrollVault.rebalance()        │
│                                                                   │
│  agent/src/server.ts  (Express + x402 gate)                       │
│  ├── GET /api/yields → returns mock yield data (gated $0.001)    │
│  └── Middleware: @x402/express paymentMiddleware                  │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow: Rebalance Cycle

```
1. Cron / manual trigger → agent.runRebalanceCycle()

2. PERCEIVE:
   a. publicClient.readContract(PayrollVault, 'totalAssets') → currentBalance
   b. fetchWithPay('http://localhost:4021/api/yields') 
      → x402 auto-handles 402 → pays $0.001 USDC → gets APR data
   c. publicClient.estimateGas for the planned rebalance tx

3. REASON:
   a. Build prompt with balance, APRs, gas cost, risk notes
   b. anthropic.messages.create({model: 'claude-sonnet-4-6', ...})
   c. Parse: recommended allocation + CFO memo text

4. ACT:
   a. walletClient.writeContract(PayrollVault, 'emitMemo', [memoHash, ''...])
      → tx hash A (memo committed on-chain)
   b. walletClient.writeContract(PayrollVault, 'rebalance', [protocols, allocations])
      → tx hash B (funds move)

5. Frontend reads new state via wagmi useReadContract hooks
   → displays memo, updated balances, yield earned
```

## Data Flow: Payday

```
1. Agent detects: block.timestamp >= scheduler.nextPayday()

2. GoPlus pre-flight for each employee:
   GET https://api.gopluslabs.io/api/v1/address_security/{address}?chain_id=84532
   → if malicious_address == "1": skip + log

3. walletClient.writeContract(PayrollScheduler, 'executePayroll')
   → vault withdraws, distributes to clean addresses

4. Frontend: employee rows update with ✅ Paid + tx hash
```

## On-Chain vs Off-Chain Boundary

| Concern | On-Chain | Off-Chain |
|---|---|---|
| USDC custody | PayrollVault.sol | — |
| Salary registry | PayrollScheduler.sol | — |
| Memo commitment (hash) | PayrollVault.emitMemo event | — |
| Memo content (text) | — | IPFS / calldata |
| Yield data (APRs) | — | x402 feed server |
| AI reasoning | — | Anthropic API |
| GoPlus security check | — | GoPlus REST API |
| Address risk enforcement | PayrollScheduler (skip flag) | GoPlus read |

## Security Design

- **Inflation attack:** Dead shares minted to `0xdead` in constructor (CertiK flag mitigation)
- **Reentrancy:** `ReentrancyGuard` on all state-changing functions
- **Agent trust:** `onlyAgent` modifier — only the registered `trustedAgent` address can call `rebalance()`; address set at deploy time, changeable by owner only
- **Payroll safety:** GoPlus pre-flight before each disbursement; malicious addresses skipped, not reverted (to prevent DoS)
- **Daily limit:** Agent enforces `MAX_REBALANCE_FRACTION = 80%` in TypeScript before signing — never drains the full vault
- **Private key:** `process.env.PRIVATE_KEY` only — never logged, never hardcoded

## Contract Dependencies

```
contracts/
├── foundry.toml          (pinned OpenZeppelin ^5.0.0)
├── src/
│   ├── PayrollVault.sol  (@openzeppelin/contracts ERC4626, ReentrancyGuard)
│   └── PayrollScheduler.sol (references PayrollVault interface)
├── script/
│   └── Deploy.s.sol      (deploys both, wires scheduler as agent)
└── test/
    └── PayrollVault.t.sol (forge tests: deposit, rebalance, payday, inflation-attack)
```
