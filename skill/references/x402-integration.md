# x402 Integration Reference

## Overview

The AI-Treasurer vault uses the x402 HTTP Payment Protocol for its yield data API.
Instead of API keys (which can be shared/leaked), the agent pays $0.001 USDC per
yield data request. This creates a sustainable micropayment model aligned with
the Coinbase Commerce / CDP sponsor track.

## How It Works

### Server Side (`agent/src/server.ts`)

```typescript
import { paymentMiddleware } from '@x402/express';

// Gate the yield endpoint behind x402
app.use(paymentMiddleware(WALLET, {
  '/api/yields': {
    price: '$0.001',
    network: 'base-sepolia',
    config: { description: 'Yield source APR data - 1 call' },
  },
}, { facilitatorUrl: X402_FACILITATOR_URL }));
```

When an un-paid request hits `/api/yields`, the middleware returns HTTP 402
with a `X-PAYMENT-REQUIRED` header containing the payment details.

### Agent Side (`agent/src/agent.ts`)

```typescript
import { wrapFetchWithPayment } from '@x402/fetch';

const fetchWithPay = wrapFetchWithPayment(fetch, walletClient);
const response = await fetchWithPay(`${YIELD_SERVER_URL}/api/yields`);
```

`wrapFetchWithPayment` intercepts the 402 response, signs a USDC micropayment
from the agent wallet, retries the request with the payment header, and
returns the data. Fully autonomous — no human approval needed.

## Payment Flow Diagram

```
Agent                     Yield Server              x402 Facilitator
  │                            │                          │
  │── GET /api/yields ────────>│                          │
  │                            │                          │
  │<── 402 + payment info ─────│                          │
  │                            │                          │
  │── sign USDC payment ──────────────────────────────────>│
  │<── signed receipt ─────────────────────────────────────│
  │                            │                          │
  │── GET /api/yields + receipt>│                          │
  │<── 200 + yield data ────────│                          │
```

## Cost Model

- **Per call**: $0.001 USDC
- **Daily agent cycles**: ~24 calls (hourly rebalance check)
- **Monthly cost**: ~$0.72 USDC for yield data
- **Monthly yield captured**: ~$6,150 on $500K vault at 14.8% APY
- **ROI**: 8,542:1

## Configuration

```env
WALLET_ADDRESS=0x_YOUR_RECEIVING_WALLET   # receives micropayments
YIELD_SERVER_URL=http://localhost:4021     # or deployed URL
X402_FACILITATOR_URL=https://x402.org/facilitator
```

## Why x402 Instead of API Keys

1. **Censorship resistant** — no central auth server to go down
2. **No key rotation needed** — payment IS the authentication
3. **Metered access** — yield server earns proportional to usage
4. **On-chain audit trail** — every data purchase is a USDC transfer
