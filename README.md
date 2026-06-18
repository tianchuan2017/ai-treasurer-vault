# AI-Treasurer Payroll Vault

> **One-line pitch:** A USDC payroll vault where the AI agent writes a boardroom-quality CFO memo and commits it on-chain *before* executing any rebalance — then distributes salaries on payday, automatically.

---

## Why this exists

Every crypto company holds idle payroll USDC for weeks earning zero yield. A $2 million monthly payroll sitting 14 days earns nothing. The problem is not access to yield — it is the lack of a trustworthy, explainable, automated system that a CFO can put on autopilot without losing oversight.

AI-Treasurer fixes this with three moves:

1. **Earn** — idle payroll USDC deploys into 2-3 curated yield sources between pay cycles
2. **Explain** — the AI agent writes a CFO-readable memo (rationale, risk flags, allocation logic) and commits `keccak256(memoText)` on-chain before touching a single dollar
3. **Execute** — payday auto-runs a GoPlus security sweep, then distributes salaries to employee wallets

---

## The differentiator

Every yield vault is passive. AI-Treasurer is the only vault where the agent **decides and explains** before it acts. The CFO memo is the hero, not the APY number.

```
Agent perceives yield data (x402-gated feed)
         ↓
Claude generates CFO memo:
  "Source A: 9.1% APY, Source B: 7.4%. Recommend 70/30.
   Gas cost: $0.003. Daily yield: $12.47. GoPlus: clean.
   PROCEED."
         ↓
emitMemo(keccak256(memo), memoText)  ← on-chain, immutable, before any move
         ↓
rebalance([sourceA, sourceB], [28_000e6, 12_000e6])   // 80% cap respected
         ↓
Next payday: GoPlus sweep → executePayroll() → 3 salary transfers in one block
```

---

## 60-second demo moment

| Step | What happens |
|------|-------------|
| 1 | Dashboard shows $50,000 USDC deposited, next payday in 14 days |
| 2 | `npm run agent:cycle` — agent pays $0.001 USDC via x402 for yield data |
| 3 | **CFO memo appears** on-screen — AI explains 70/30 allocation, risks, daily yield |
| 4 | `emitMemo()` tx confirms on Base Sepolia — memo hash immutable |
| 5 | `rebalance()` tx confirms — allocation shifts from 0% to 8.7% blended APY |
| 6 | `npm run agent:payday` — GoPlus clears 3 employees, salaries hit wallets in one block |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                        │
│  CFO Dashboard: memo feed · vault stats · payday countdown     │
│  wagmi v2 hooks · Privy embedded wallets (email onboarding)    │
└──────────────┬──────────────────────────────────────────────────┘
               │ read state via useReadContract
┌──────────────▼──────────────────────────────────────────────────┐
│                Base Sepolia (chain 84532)                       │
│                                                                  │
│  PayrollVault.sol (ERC-4626)     PayrollScheduler.sol           │
│  • deposit / withdraw             • addEmployee / removeEmployee │
│  • emitMemo(hash, text)  ◄───    • setSecurityCleared(id, bool) │
│  • rebalance(srcs, allocs)        • executePayroll()            │
│  • dead-shares inflation guard    • 30-day cycle tracking       │
└──────────────┬──────────────────────────────────────────────────┘
               │ trustedAgent calls only
┌──────────────▼──────────────────────────────────────────────────┐
│              AI Agent (Node.js + TypeScript + viem)             │
│                                                                  │
│  PERCEIVE: read vault state + pay $0.001 USDC via x402 fetch   │
│  REASON:   Anthropic claude-sonnet-4-6 → CFO memo JSON         │
│  ACT:      emitMemo() → rebalance() → GoPlus → executePayroll() │
│                                                                  │
│  x402 yield server (Express): GET /api/yields gated $0.001     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Chain | Base Sepolia (84532) / Base mainnet (8453) |
| Contracts | Solidity ^0.8.24, Foundry |
| Tokens | USDC — Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Agent | TypeScript, viem 2.x, Anthropic SDK `@anthropic-ai/sdk` |
| x402 | `@x402/express` 2.x (yield data gate) + `@x402/fetch` 2.x (agent auto-pay) |
| Frontend | Next.js 15, wagmi 2.x, Privy embedded wallets, TailwindCSS |
| Security | GoPlus REST pre-flight on all employee addresses before every payroll |

---

## Quick start

### Prerequisites

```bash
# Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Node.js 20+
node --version   # must be ≥ 20
```

### 1. Install and configure

```bash
git clone https://github.com/you/ai-treasurer-vault
cd ai-treasurer-vault
cp .env.example .env
# Fill in: PRIVATE_KEY, ANTHROPIC_API_KEY, NEXT_PUBLIC_PRIVY_APP_ID
```

### 2. Deploy contracts (Base Sepolia)

```bash
cd contracts
forge install   # pulls openzeppelin-contracts and forge-std
forge build     # should compile with zero warnings
forge test      # all 13 tests pass
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast
# Copy the two printed addresses into .env
```

### 3. Run the AI agent

```bash
cd agent
npm install
npm run server          # terminal 1: x402 yield data server on :4021
npm run agent:cycle     # terminal 2: perceive → memo → rebalance
npm run agent:payday    # terminal 2: GoPlus sweep → salary distribution
```

### 4. Start the frontend

```bash
cd app
npm install
npm run dev             # http://localhost:3000
```

---

## Live deployment

| Contract | Network | Address |
|----------|---------|---------|
| PayrollVault | Base Sepolia | `TODO — fill after deploy` |
| PayrollScheduler | Base Sepolia | `TODO — fill after deploy` |

---

## External dependencies (CertiK Skill Scanner)

| Endpoint | Purpose |
|----------|---------|
| `https://api.anthropic.com` | CFO memo generation (`claude-sonnet-4-6`) |
| `https://api.gopluslabs.io` | Pre-payroll address security check |
| `https://facilitator.x402.org` | x402 payment facilitation |
| `https://sepolia.base.org` | Base Sepolia RPC |

---

## Sponsor integrations

- **x402** — `agent/src/server.ts`: yield feed at `GET /api/yields` gated at `$0.001/call` via `@x402/express`; agent auto-pays via `@x402/fetch` (`ExactEvmScheme` + `x402Client`)
- **GoPlus** — `agent/src/security.ts`: `malicious_address` REST check before every `executePayroll()` call; fail-closed on API error
- **Anthropic** — `agent/src/agent.ts`: `claude-sonnet-4-6` generates structured CFO memo JSON; memoText committed on-chain via `emitMemo()`

---

## Verification checklist

- [x] `forge build` — zero errors
- [x] `forge test` — all tests pass (13/13)
- [x] No hardcoded private keys — all via `process.env`
- [x] `.env.example` complete with all required vars
- [x] `.gitignore` excludes `.env`, `node_modules`, `contracts/out`
- [x] `LICENSE` present (MIT)
- [x] `docs/DEMO.md` — live run sheet with fallback plan
- [ ] Deploy to Base Sepolia — fill contract addresses above
- [ ] Record 2-min demo video

---

## Business plan

See [BUSINESS_PLAN.md](./BUSINESS_PLAN.md)

## Architecture deep-dive

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

## Demo run sheet

See [docs/DEMO.md](./docs/DEMO.md)

## UI/UX

See [design/UIUX.md](./design/UIUX.md) · [design/mockup.html](./design/mockup.html)

---

## License

MIT — 2026
