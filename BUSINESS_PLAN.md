# Business Plan — AI-Treasurer Payroll Vault

---

## Problem

Corporate treasury teams hold idle USDC in wallets earning zero yield between payroll cycles.

| Payroll pool | Idle days | APY | Unrealized yield / cycle | Annualized |
|-------------|-----------|-----|--------------------------|------------|
| $500K | 14 | 8% | $1,534 | $18,400 |
| $2M | 14 | 8% | $6,137 | $73,600 |
| $10M | 14 | 8% | $30,685 | $368,000 |

Every crypto-native company with a USDC payroll leaves this on the table. The bottleneck is not access to yield protocols — it is the absence of an explainable, auditable, automated layer that a CFO can put on autopilot without losing oversight.

Manual yield deployment requires: finance team routing funds each cycle, risk review before each movement, reconciliation before payday withdrawal, and audit trail documentation. This is why 95% of crypto-native companies leave payroll funds idle.

---

## Solution

AI-Treasurer automates the full cycle:

```
Deposit USDC into vault
        ↓
AI agent monitors yield sources (x402-gated data feed every 6 hours)
        ↓
Writes CFO memo: allocation rationale, risk flags, gas cost analysis
        ↓
Commits memo on-chain (keccak256 hash + full text) — immutable audit trail
        ↓
Executes rebalance to approved yield protocol addresses
        ↓
On payday: GoPlus security sweep per employee → distribute salaries
```

The CFO gets yield + oversight. Employees get paid. No one touches a private key mid-cycle.

---

## Target market

**Primary (Year 1):** Crypto-native companies and DAOs paying 10–500 employees in stablecoins. These companies already hold USDC; they just don't optimize it.

- ~15,000 crypto-native companies globally (Crunchbase/Messari 2025 estimates)
- Estimated avg. payroll USDC per company: $500K–$5M
- Serviceable addressable market (1,000 co's × $2M avg × 0.5% fee × 8% APY): **$800K ARR**

**Secondary (Year 2–3):** Traditional companies onboarding to crypto payroll (Bitwage-style adoption). The Privy embedded wallet removes the "send employees a seed phrase" friction entirely.

**Expansion:** Any company using USDC treasury management beyond payroll — grant programs, vendor payments, operating reserves.

---

## Revenue model

**Protocol fee: 0.5% of yield generated** — not AUM. Aligned with performance.

| Scenario | Vaults | Avg pool | Avg yield/mo | Protocol fee/mo | ARR |
|----------|--------|----------|--------------|-----------------|-----|
| Early (6 mo) | 20 | $500K | $3,200 | $16 | $3,800 |
| Growth (18 mo) | 200 | $1M | $6,400 | $32 | $77,000 |
| Scale (36 mo) | 2,000 | $2M | $12,800 | $64 | $1.5M |

**Premium tier ($149/month):** Custom yield strategy approval flows, Slack/email memo delivery, priority GoPlus enterprise API, Gnosis Safe module integration.

No charge on idle principal. No charge on payroll distributions. Fee only on yield earned — fully aligned.

---

## Go-to-market

**Phase 1 (Months 1–3): Direct to crypto DAOs**
- Target 20 DAOs and DeFi protocols via Telegram and Discord outreach
- These communities already pay salaries in USDC and have treasury multisigs
- Offer white-glove onboarding and co-marketing in exchange for testimonials

**Phase 2 (Months 3–9): Gnosis Safe integration**
- Build as a SafeApp module — access to 8M+ Safe wallets
- Position: "the yield plugin for your payroll Safe"
- Safe App Store listing drives organic discovery from existing treasury managers

**Phase 3 (Months 9–24): API and payroll provider partnerships**
- API integrations with Request Network, Superfluid, Sablier
- Position AI-Treasurer as the yield layer before their disbursements
- White-label for payroll providers entering USDC-native companies

---

## Moat and defensibility

**1. The CFO memo as trust layer**
The human-readable memo before each rebalance is a UX moat that compounds over time. Competitors without it feel like a black box — regulated entities and enterprise treasury teams will not deploy idle cash into a vault they cannot explain to their board or auditors. This is not a feature; it is the product.

**2. Immutable on-chain audit trail**
Every memo hash is stored on-chain — an immutable compliance record. This becomes increasingly valuable as regulators scrutinize on-chain treasury operations. Early adopters build a verifiable history that becomes a switching cost.

**3. Network effects in yield intelligence**
As more vaults deploy, the agent's x402-gated yield data aggregates anonymized protocol performance. More data → better allocation models → better yields → more vaults. The yield data feed itself becomes a defensible asset.

**4. Safe module lock-in**
Once a company's Gnosis Safe is wired to AI-Treasurer, switching cost is real: multisig reconfiguration, team retraining, loss of on-chain memo history. Monthly active vaults convert to sticky annual contracts.

---

## Why now

**1. USDC on-chain payroll is mainstream in 2026.** Coinbase, Binance, and OKX all offer payroll-USDC rails. The supply side is solved. Companies are ready.

**2. x402 and ERC-4626 are production-stable.** The primitives for pay-per-call AI data and standardized yield vaults matured in 2024–2025. Building on them is de-risked and composable.

**3. The AI-agent wave needs a trust layer.** In 2025, builders proved agents can execute financial transactions. In 2026, the question is "can we trust the agent's reasoning?" AI-Treasurer answers with the CFO memo — an immutable, auditable reasoning trail before every action.

**4. Regulatory tailwind.** MiCA (EU) and stablecoin frameworks globally are pushing institutions to demand audit trails for on-chain treasury operations. AI-Treasurer's on-chain memo history is compliance-ready by design.

---

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Yield source smart contract bug | Approved source whitelist controlled by multisig owner; 80% max rebalance cap; agent cannot move to unapproved addresses |
| Agent key compromise | `trustedAgent` limited to approved sources only; `setAgent()` rotation by owner; daily rebalance cap enforced at agent layer |
| LLM generates bad memo / wrong allocation | `PROCEED` / `HOLD` / `REVIEW` decision gate; human override window before execution (configurable timeout) |
| GoPlus API outage | Fail-closed: if GoPlus cannot confirm clean, employee address is NOT paid — no false positives on the safe side |
| Regulatory change re: on-chain payroll | Modular architecture: swap yield sources or disable module without changing payroll logic |

---

*AI-Treasurer Payroll Vault — 2026-06-18*
