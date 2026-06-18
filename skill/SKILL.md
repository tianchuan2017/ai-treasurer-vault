# AI-Treasurer Payroll Vault — Pharos Skill Card

> Pharos AI Carnival 2026 · Skill Engine format v1.2

## Skill Identity

| Field | Value |
|---|---|
| **Skill Name** | ai-treasurer-payroll-vault |
| **Category** | DeFi / Treasury Management / AI Agent |
| **Version** | 1.0.0 |
| **Author** | Chuan Tian |
| **License** | MIT |
| **Chain** | Base (8453) · Base Sepolia (84532) |
| **LLM Backend** | claude-sonnet-4-6 (Anthropic) |

---

## One-liner

An AI agent that earns yield on idle payroll USDC, auto-writes a CFO-readable rebalance memo on-chain, and executes payday — no spreadsheet needed.

---

## Problem

Every crypto-native company holds USDC in a multisig earning 0% APY while they wait for payday.  
For a 10-person team with $500K in the vault, that's **~$6,150 lost per 30-day cycle** (vs 14.8% best yield on Base).

Current workarounds: manual spreadsheets, weekly CFO sign-off calls, fear of smart-contract risk.

---

## Solution Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  PERCEPTION                                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ PayrollVault (ERC-4626)  totalAssets / memoCount / sources  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                           │                                        │
│                           ▼                                        │
│  ENRICHMENT  ────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ x402 Yield Server ($0.001/call)   APR · TVL · risk score  │    │
│  └───────────────────────────────────────────────────────────┘    │
│                           │                                        │
│                           ▼                                        │
│  REASON  ────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ claude-sonnet-4-6  →  CFO Memo (JSON)                     │    │
│  │  memoText · allocations · recommendation · risks          │    │
│  └───────────────────────────────────────────────────────────┘    │
│                           │                                        │
│                           ▼                                        │
│  ACT  ───────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │ emitMemo(keccak256, ipfsCid)  →  rebalance(sources, bps)  │    │
│  └───────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Differentiator

**The CFO memo is written on-chain BEFORE every rebalance — not after.**

Every `rebalance()` call is preceded by `emitMemo()`, which writes:
- `keccak256(memoText)` — integrity hash stored in contract state
- Full memo as calldata event — immutable, searchable, human-readable

This creates an auditable paper trail that finance teams can actually read. No black-box AI. No "trust the algorithm." The memo IS the approval record.

---

## Sponsor Integration Points

| Sponsor | Integration | File | Line |
|---|---|---|---|
| **x402 (Coinbase)** | Micropayment gate on yield data API — agent pays $0.001/call, no API key sharing | `agent/src/server.ts` | 28 |
| **x402 (Coinbase)** | `wrapFetchWithPayment` auto-handles 402 responses | `agent/src/agent.ts` | 61 |
| **GoPlus Security** | Pre-payroll employee address security sweep | `agent/src/security.ts` | 1 |
| **Anthropic Claude** | CFO memo generation (structured JSON output) | `agent/src/agent.ts` | 88 |
| **Base / Coinbase** | Deployed on Base Sepolia; targets Base Mainnet | `contracts/foundry.toml` | 16 |

---

## Perceive → Reason → Act Loop

```typescript
// Perceive
const vault = await perceiveVaultState();           // on-chain state
const yields = await fetchYieldData();              // x402-gated data

// Reason
const memo = await generateCFOMemo(vault, yields);  // Anthropic LLM

// Act
await commitMemoOnChain(memo);    // emitMemo() — FIRST
await executeRebalance(memo);     // rebalance() — AFTER memo committed
```

The loop is intentionally synchronous: the on-chain memo MUST be mined before `rebalance()` is submitted. This ordering is enforced by `waitForTransactionReceipt` between the two calls.

---

## Security Properties

| Property | Implementation |
|---|---|
| Inflation attack | Dead shares: `_mint(address(0xdead), 1000)` in constructor |
| Reentrancy | `nonReentrant` on rebalance + executePayroll |
| Agent authority | `onlyAgent` modifier; owner can rotate via `setAgent()` |
| Max rebalance cap | `MAX_REBALANCE_BPS = 8000` (80%) — enforced both off- and on-chain |
| Employee DoS | `executePayroll()` skips (not reverts) uncleaned addresses |
| GoPlus check | `setSecurityCleared()` required per employee before payday |
| Private keys | Only from `process.env` — never hardcoded |
| External calls | All declared as comments for CertiK Skill Scanner compliance |

---

## Demo Flow (90 seconds)

1. **Connect** — Privy email login, embedded wallet created instantly
2. **Dashboard** — Live vault state: $500K idle, 14.8% best APY available
3. **Agent cycle** — `node agent/src/agent.ts --mode=demo`
   - Fetches yield data (x402 payment visible in terminal)
   - Anthropic generates CFO memo
   - `emitMemo()` tx mined → memo appears on dashboard
   - `rebalance()` tx mined → allocation bars shift
4. **Payday** — `executePayroll()` distributes 10 salaries, GoPlus badge confirms all clear

---

## Run Instructions

```bash
# 1. Deploy contracts
cd contracts && forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY --broadcast --verify

# 2. Start yield server
cd agent && npm install && npm run server

# 3. Run agent demo
npm run agent:demo

# 4. Start frontend
cd ../app && npm install && npm run dev
```

---

## Files

```
contracts/src/PayrollVault.sol       ERC-4626 yield vault with memo commitment
contracts/src/PayrollScheduler.sol   30-day payroll cycle with GoPlus gating
contracts/script/Deploy.s.sol        Foundry deploy script
contracts/test/PayrollVault.t.sol    Full Foundry test suite (14 tests)
agent/src/agent.ts                   Perceive-Reason-Act orchestrator
agent/src/server.ts                  x402-gated yield data API
agent/src/security.ts                GoPlus security sweep
agent/src/chains.ts                  Chain + USDC address config
agent/src/abis.ts                    Contract ABIs for agent
app/app/page.tsx                     Next.js dashboard (wagmi + Privy)
app/app/providers.tsx                PrivyProvider + WagmiProvider setup
app/lib/wagmi.ts                     wagmiConfig with Base chains
app/lib/abis.ts                      Frontend contract ABIs
design/mockup.html                   Self-contained UI mockup (no deps)
```

---

## External Dependencies Declared (CertiK Skill Scanner)

- `https://api.gopluslabs.io/api/v1/address_security/{address}` — READ-ONLY security oracle
- `https://api.anthropic.com/v1/messages` — LLM reasoning (Anthropic)
- `https://x402.org/facilitator` — x402 payment facilitation (testnet)
- `https://sepolia.base.org` — Base Sepolia RPC
- `https://mainnet.base.org` — Base Mainnet RPC

No child_process.exec. No arbitrary fs writes. No eval(). No hardcoded private keys.
