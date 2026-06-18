/**
 * server.ts — x402-gated yield data feed
 *
 * Runs a simple Express server that serves yield APR data behind a $0.001 USDC
 * x402 micropayment gate. The AI agent auto-pays this via @x402/fetch.
 *
 * Uses the x402 v2 API:
 *   - @x402/express: paymentMiddleware + x402ResourceServer
 *   - @x402/evm/exact/server: ExactEvmScheme
 *   - @x402/core/server: HTTPFacilitatorClient
 *
 * Declared external endpoints (CertiK Skill Scanner compliance):
 *   - https://facilitator.x402.org   (x402 testnet facilitator)
 *   - https://sepolia.base.org       (Base Sepolia RPC)
 *
 * Port: 4021 (x402 convention)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { BASE_SEPOLIA_CHAIN_ID, X402_NETWORK } from './chains';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT    = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 4021;
const PAY_TO  = (process.env.WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
const CHAIN_ID = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : BASE_SEPOLIA_CHAIN_ID;
const NETWORK  = (X402_NETWORK[CHAIN_ID] ?? 'eip155:84532') as `eip155:${number}`;
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? 'https://facilitator.x402.org';

// ─── x402 v2 Resource Server ─────────────────────────────────────────────────

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme()
);

// Apply x402 payment middleware (v2 API)
app.use(
  paymentMiddleware(
    {
      'GET /api/yields': {
        accepts: {
          scheme: 'exact',
          price: '$0.001',
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: 'Real-time yield APR data for Base Sepolia DeFi protocols',
      },
    },
    resourceServer
  )
);

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/yields
 * Returns current yield APRs for 2 demo protocols (source A, source B).
 * In production: replace with real on-chain TVL queries or protocol APIs.
 *
 * This endpoint is gated by $0.001 USDC via x402.
 */
app.get('/api/yields', (_req, res) => {
  const baseAPR_A = 9.1;
  const baseAPR_B = 7.4;
  const jitter = () => (Math.random() - 0.5) * 0.4;

  const data = {
    timestamp: Math.floor(Date.now() / 1000),
    sources: [
      {
        id:      'source_a',
        name:    'Source A (Aave-style USDC)',
        address: process.env.YIELD_SOURCE_A ?? '0xA11CE0000000000000000000000000000000000A',
        aprBps:  Math.round((baseAPR_A + jitter()) * 100),
        aprPct:  parseFloat((baseAPR_A + jitter()).toFixed(2)),
        tvlUSDC: 12_400_000,
        risk:    'low',
        audited: true,
      },
      {
        id:      'source_b',
        name:    'Source B (Morpho-style USDC)',
        address: process.env.YIELD_SOURCE_B ?? '0xB0B0000000000000000000000000000000000B0B',
        aprBps:  Math.round((baseAPR_B + jitter()) * 100),
        aprPct:  parseFloat((baseAPR_B + jitter()).toFixed(2)),
        tvlUSDC: 4_800_000,
        risk:    'low',
        audited: true,
      },
    ],
    gasEstimateUSDC: 0.003,
    network: NETWORK,
    chainId: CHAIN_ID,
  };

  res.json(data);
});

/**
 * GET /api/health — free endpoint, no payment required
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    server:    'ai-treasurer-yield-feed',
    chain:     NETWORK,
    payTo:     PAY_TO,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[x402 Yield Server] Running on http://localhost:${PORT}`);
  console.log(`[x402 Yield Server] Pay-to wallet: ${PAY_TO}`);
  console.log(`[x402 Yield Server] Network: ${NETWORK}`);
  console.log(`[x402 Yield Server] Facilitator: ${FACILITATOR_URL}`);
  console.log(`[x402 Yield Server] GET /api/yields  → $0.001 USDC`);
  console.log(`[x402 Yield Server] GET /api/health  → free`);
});
