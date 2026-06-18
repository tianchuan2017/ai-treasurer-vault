# UI/UX Design — AI-Treasurer Payroll Vault

## Design Philosophy

This is a CFO dashboard, not a degen DeFi app. The audience is a finance professional who needs to trust the system before putting payroll on autopilot. The design conveys:
- **Legibility over flashiness** — no neon gradients, no ticker tape
- **Oversight as a feature** — the AI memo is the hero, not the vault balance
- **Invisible blockchain** — gas, tx hashes, and chain IDs are optional depth, not the default view

---

## Color Palette

| Role | Color | Hex |
|---|---|---|
| Primary (slate navy) | Background, headers | `#0F172A` |
| Secondary (indigo) | Action buttons, highlights | `#4F46E5` |
| Accent (emerald) | Yield positive, success | `#10B981` |
| Warning (amber) | Pending, attention | `#F59E0B` |
| Danger (red) | Errors, rejected addresses | `#EF4444` |
| Surface | Cards, panels | `#1E293B` |
| Text primary | Main content | `#F8FAFC` |
| Text secondary | Labels, captions | `#94A3B8` |
| Border | Subtle dividers | `#334155` |

---

## Typography

| Use | Font | Size | Weight |
|---|---|---|---|
| Heading H1 | Inter | 28px | 700 |
| Heading H2 | Inter | 20px | 600 |
| Body | Inter | 14px | 400 |
| Monospace (addresses, hashes) | JetBrains Mono | 12px | 400 |
| Memo text | Georgia serif | 15px | 400 (readability) |
| Numbers/amounts | Tabular nums Inter | 24px | 600 |

---

## Component List

- `VaultStats` — 4 stat cards: Total Deposited, Yield Earned, Next Payday, APY Current
- `CFOMemoFeed` — vertical feed of memo cards; each shows allocation, rationale, timestamp, on-chain link
- `MemoCard` — the hero component; serif memo text + allocation badges + approve/override buttons
- `EmployeeTable` — rows: name/address, salary, status badge (Pending / Paid / Flagged), last paid
- `RebalanceButton` — triggers `npm run agent:cycle`; shows spinner during execution
- `PaydayButton` — triggers `executePayroll()`; disabled if payday not due
- `WalletConnect` — Privy `login()` button; shows "Connect via Email" for non-crypto users
- `TxToast` — bottom-right toast with tx hash + block explorer link on every confirmed tx
- `YieldAllocationBar` — horizontal stacked bar: Source A % / Source B % / Idle %
- `SecurityBadge` — per-employee GoPlus status: ✅ Clean / ⚠️ Unknown / ❌ Flagged

---

## Screen-by-Screen Wireframe

### Screen 1: Connect / Onboard

```
┌─────────────────────────────────────────────────────┐
│              AI-Treasurer                           │
│      Payroll Vault · Powered by AI                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │        Sign in with Email                   │   │
│  │  ┌─────────────────────────────────────┐   │   │
│  │  │  your@company.com              [→]  │   │   │
│  │  └─────────────────────────────────────┘   │   │
│  │  or connect existing wallet                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  No seed phrases. No browser extensions.            │
│  Your wallet is created automatically.              │
└─────────────────────────────────────────────────────┘
```

### Screen 2: CFO Dashboard (main view)

```
┌──────────────────────────────────────────────────────────────────────┐
│ AI-Treasurer     [Base Sepolia ▾]           [0x1234...5678 ▾]       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Total Pool   │ │ Yield Earned │ │ Current APY  │ │ Next Payday│ │
│  │  $50,000     │ │   $247.33    │ │    8.7%      │ │  14 days   │ │
│  │   USDC       │ │  this cycle  │ │              │ │            │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                      │
│  Allocation                                                          │
│  ████████████████████████░░░░░░░░░░░░░░                             │
│  Source A (9.1% APY)  70%   Source B (7.4%)  30%                   │
│                                                                      │
│  ┌─────────────────────────────┐  ┌────────────────────────────┐    │
│  │  [⚡ Run AI Rebalance ]    │  │  [💸 Execute Payday ]      │    │
│  └─────────────────────────────┘  └────────────────────────────┘    │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  AI CFO Memos                                                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🤖 Memo · 2026-06-18 09:14 UTC  [0xabc...def ↗]            │  │
│  │                                                               │  │
│  │  "Source A currently yields 9.1% APY vs Source B at 7.4%.   │  │
│  │  I recommend a 70/30 split to maximize yield while           │  │
│  │  maintaining 30% liquidity buffer ahead of payday.           │  │
│  │  Gas cost for this rebalance: $0.003 — yield earned          │  │
│  │  today covers this in 45 minutes. No security flags          │  │
│  │  from GoPlus on deployed protocol addresses.                 │  │
│  │  Recommendation: PROCEED."                                   │  │
│  │                                                               │  │
│  │  Allocation: ██████████░░░ A: 70%  B: 30%  Idle: 0%        │  │
│  │  [✅ Approved by agent]  [On-chain proof ↗]                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  🤖 Memo · 2026-06-11 09:02 UTC  [0x789...123 ↗]            │  │
│  │  "..."  [collapsed]                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Employees (next payday: 14 days)                                    │
│                                                                      │
│  Name/Address            Salary     Status         Last Paid        │
│  Alice  0xA1...B2        $5,000     ✅ Scheduled   Jun 4, 2026      │
│  Bob    0xC3...D4        $3,500     ✅ Scheduled   Jun 4, 2026      │
│  Carol  0xE5...F6        $4,200     ✅ Scheduled   Jun 4, 2026      │
│                                                                      │
│  GoPlus: All addresses clean ✅                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Screen 3: Post-Rebalance (live txn state)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Rebalance Executing...                                              │
│                                                                      │
│  [✅] Memo committed on-chain   tx: 0xabc... ↗                     │
│  [⏳] Rebalance executing...    tx: 0xdef... (pending)              │
│  [  ] Allocation updated                                             │
│                                                                      │
│  ████████████████████░░░░░░░░░░░░░░░░░░ 55% complete               │
└──────────────────────────────────────────────────────────────────────┘
```

### Screen 4: Payday Execution

```
┌──────────────────────────────────────────────────────────────────────┐
│  Payday — 3 employees                                                │
│                                                                      │
│  🔐 GoPlus Security Check                                            │
│  Alice  0xA1...B2  ✅ Clean   — paying $5,000                       │
│  Bob    0xC3...D4  ✅ Clean   — paying $3,500                       │
│  Carol  0xE5...F6  ✅ Clean   — paying $4,200                       │
│                                                                      │
│  [💸 Confirm and Send Payroll ]                                      │
│                                                                      │
│  Total: $12,700 USDC · 3 transactions                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Layout

- **Desktop (1200px+):** 4-column stat grid + 2-column layout (memos left, employees right)
- **Tablet (768px–1199px):** 2-column stat grid + single column below
- **Mobile (< 768px):** Single column, memos collapsed by default; full-screen payday flow

---

## Interaction Notes

- **Rebalance button** triggers terminal-style progress overlay showing agent steps in real time (SSE stream from agent server)
- **Memo cards** use serif typography for readability — these are financial documents, not tweets
- **Tx hash links** open block explorer in new tab; shown only in "Advanced" toggle by default (invisible blockchain principle)
- **Employee addresses** are truncated by default; click to expand full address with copy button
