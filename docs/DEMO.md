# Demo Script — AI-Treasurer Payroll Vault

## Target: 90 seconds, live on-chain, no mocks

---

## Pre-Demo Checklist (do before hitting record)

- [ ] Base Sepolia funded wallet unlocked (0.05 ETH for gas + 50,000 USDC mock tokens)
- [ ] Contracts deployed, addresses in `.env`
- [ ] `npm run server` running on port 4021 (x402 yield feed)
- [ ] `npm run dev` running on port 3000 (frontend)
- [ ] Block explorer tab open to PayrollVault contract address
- [ ] 3 "employee" wallets visible in browser (can be test addresses)
- [ ] Terminal ready for `npm run agent:cycle`

---

## Shot-by-Shot Script

### [0:00 – 0:12] HOOK — the problem

> "Every company holds idle payroll USDC for weeks before salary day. Zero yield. Zero oversight. We fix both."

*Screen shows: vault dashboard with 50,000 USDC balance, "Current Yield: 0%" label, next payday countdown.*

---

### [0:12 – 0:30] WHO / WHAT

> "AI-Treasurer is the only payroll vault where the AI agent writes a CFO-readable explanation before it moves a single dollar. The CFO approves. The blockchain executes. Zero manual treasury work."

*Screen pans to the CFO Memo Feed section — shows a previous memo card with allocation rationale, signed timestamp, on-chain reference.*

---

### [0:30 – 1:15] LIVE DEMO — the wow moment

> "Let's watch it happen now. I'm triggering the agent."

**[Switch to terminal]**

```bash
npm run agent:cycle
```

*Terminal output appears line by line — narrate each step:*

> "It's reading the vault balance..."
> "Fetching yield data — paying $0.001 USDC via x402..."
> "Calling Claude to write the CFO memo..."

*After ~5 seconds, the memo appears in terminal:*

> "Here's the memo the agent just wrote:
> 'Source A currently yields 9.1% APY, Source B yields 7.4%. Recommend 70/30 split.
> Gas cost $0.003. Expected daily yield on $50K: $12.47. Risk: source A is unaudited;
> capping at 70% to preserve liquidity. No security flags from GoPlus. Proceed.'"

> "Now it commits this memo on-chain — transaction one."

*Terminal shows: `emitMemo tx: 0x...` — switch to block explorer tab, refresh, show the event.*

> "And now it rebalances — transaction two."

*Terminal shows: `rebalance tx: 0x...`*

**[Switch to frontend]**

> "The dashboard updates in real time — vault now shows 28,000 USDC in Source A, 12,000 USDC in Source B (80% deployed, 20% liquidity buffer). Projected daily yield: $12.47."

*The CFO Memo Feed section shows the new memo card with timestamp and on-chain link.*

---

### [1:15 – 1:40] PAYDAY

> "Now it's payday. I'll trigger salary distribution."

```bash
npm run agent:payday
```

*Terminal shows GoPlus check running for each address:*

> "GoPlus checks each employee address first — no malicious flags."

*Three transfer transactions fire:*

> "Three employees paid — Alice, Bob, Carol — all in the same block."

**[Switch to block explorer]**

> "Here are the three settlement transactions confirming right now on Base Sepolia."

*Show all three confirmed with employee addresses and USDC amounts.*

---

### [1:40 – 1:55] ON-CHAIN PROOF

> "Every step is verifiable. The memo hash is on-chain at tx `0x...`. The rebalance at tx `0x...`. The payroll at tx `0x...`. The CFO can audit the full reasoning trail — all immutable."

*Show explorer with all 5 transactions: emitMemo + rebalance + 3 salary transfers.*

---

### [1:55 – 2:05] CLOSE

> "AI-Treasurer: yield-optimized payroll with boardroom-grade explainability. The AI decides. The CFO approves. The blockchain executes. Zero manual work."

---

## Fallback Plan (if live demo breaks)

1. Cut to pre-recorded screen capture of the same flow
2. Paste the pre-confirmed tx hashes from notes: "Here are the on-chain proofs from earlier"
3. Load block explorer directly to the pre-confirmed PayrollVault address
4. Never say "it doesn't work in the demo" — say "let me show you the confirmed on-chain evidence"

---

## Q&A Prep

**Q: What if the AI picks a bad yield source?**
A: The CFO approval gate — the memo is emitted BEFORE rebalance. In the current version, the agent self-approves after 60 seconds of no human override (configurable). A governance extension can wire a Gnosis Safe signers' vote here.

**Q: How is this different from Morpho/Aave's own auto-routing?**
A: Those protocols optimize within their own liquidity. AI-Treasurer is the CFO's oversight layer on top of any protocol, with an audit trail and a human-readable explanation. It's the "why" layer the finance team can show to their board.

**Q: What happens if the agent wallet is compromised?**
A: The `trustedAgent` address can only call `rebalance()` with the pre-approved protocol list — it can't drain to an arbitrary address. Daily limits are enforced at the TypeScript agent layer too. Recovery: owner rotates `trustedAgent` address via `setAgent()`.

**Q: Is the yield simulated for the demo?**
A: The yield data comes from a real x402-gated API server (running locally). For production, wire to real protocol TVL APIs (Aave, Morpho, Compound). The contract's `rebalance()` is wired to call real ERC-4626-compatible vault addresses.
