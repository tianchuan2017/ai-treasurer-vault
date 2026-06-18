/**
 * agent.ts — AI-Treasurer Agent
 *
 * Implements the perceive → reason → act loop:
 *   1. PERCEIVE: read vault state + pay for yield data via x402
 *   2. REASON:   call LLM to generate the CFO memo + allocation decision
 *   3. ACT:      emit memo on-chain → rebalance vault → optionally execute payroll
 *
 * Declared external endpoints (CertiK Skill Scanner compliance):
 *   - https://api.anthropic.com       (LLM inference)
 *   - https://api.gopluslabs.io       (GoPlus security check)
 *   - http://localhost:4021           (x402 yield data server)
 *   - https://x402.org/facilitator   (x402 payment facilitation)
 *   - https://sepolia.base.org        (Base Sepolia RPC)
 *
 * Private keys: only via process.env — never logged, never hardcoded.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { PAYROLL_VAULT_ABI, PAYROLL_SCHEDULER_ABI } from './abis';
import { checkAllAddresses } from './security';
import { BASE_SEPOLIA_CHAIN_ID } from './chains';

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIVATE_KEY          = (process.env.PRIVATE_KEY ?? '') as `0x${string}`;
const VAULT_ADDRESS        = (process.env.PAYROLL_VAULT_ADDRESS ?? '') as `0x${string}`;
const SCHEDULER_ADDRESS    = (process.env.PAYROLL_SCHEDULER_ADDRESS ?? '') as `0x${string}`;
const YIELD_SERVER_URL     = process.env.YIELD_SERVER_URL ?? 'http://localhost:4021';
const CHAIN_ID             = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : BASE_SEPOLIA_CHAIN_ID;
const LLM_MODEL            = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';
const MAX_REBALANCE_BPS    = 8000; // 80% max — matches contract

// ─── Clients ─────────────────────────────────────────────────────────────────

if (!PRIVATE_KEY || PRIVATE_KEY === '0x') {
  throw new Error('PRIVATE_KEY not set in .env');
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain:     baseSepolia,
  transport: http(process.env.BASE_RPC_URL ?? 'https://sepolia.base.org'),
});

const walletClient = createWalletClient({
  account,
  chain:     baseSepolia,
  transport: http(process.env.BASE_RPC_URL ?? 'https://sepolia.base.org'),
});

// x402-aware fetch (v2 API) — auto-pays $0.001 USDC when server returns 402.
// ExactEvmScheme expects a signer with .address + .signTypedData.
// We build a thin adapter from our viem account + walletClient.
const x402Signer = new ExactEvmScheme({
  address: account.address,
  signTypedData: (args: Parameters<typeof walletClient.signTypedData>[0]) =>
    walletClient.signTypedData(args),
  signTransaction: (args: Parameters<typeof walletClient.signTransaction>[0]) =>
    walletClient.signTransaction(args),
});
const x402PayClient = new x402Client().register('eip155:84532', x402Signer);
const fetchWithPay = wrapFetchWithPayment(fetch, x402PayClient);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // baseURL can be overridden for Alibaba Cloud DashScope compatibility:
  // baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface YieldSource {
  id: string;
  name: string;
  address: string;
  aprPct: number;
  tvlUSDC: number;
  risk: string;
  audited: boolean;
}

interface YieldData {
  timestamp: number;
  sources: YieldSource[];
  gasEstimateUSDC: number;
}

interface VaultState {
  totalAssetsUSDC: number;
  memoCount: bigint;
  yieldSources: readonly `0x${string}`[];
}

interface CFOMemoDecision {
  memoText: string;
  allocations: Array<{ sourceAddress: string; amountUSDC: number; rationale: string }>;
  recommendation: 'PROCEED' | 'HOLD' | 'REVIEW';
  confidence: number; // 0-1
  risks: string[];
}

// ─── Phase 1: PERCEIVE ───────────────────────────────────────────────────────

async function perceiveVaultState(): Promise<VaultState> {
  console.log('[PERCEIVE] Reading vault state from chain...');

  if (!VAULT_ADDRESS) throw new Error('PAYROLL_VAULT_ADDRESS not set');

  const [totalAssetsRaw, memoCount, yieldSources] = await Promise.all([
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: PAYROLL_VAULT_ABI,
      functionName: 'totalAssets',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: PAYROLL_VAULT_ABI,
      functionName: 'memoCount',
    }),
    publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: PAYROLL_VAULT_ABI,
      functionName: 'getYieldSources',
    }),
  ]);

  const totalAssetsUSDC = Number(totalAssetsRaw) / 1e6;

  console.log(`[PERCEIVE] Total assets: $${totalAssetsUSDC.toLocaleString()} USDC`);
  console.log(`[PERCEIVE] Memo count: ${memoCount}`);
  console.log(`[PERCEIVE] Yield sources: ${yieldSources.length}`);

  return { totalAssetsUSDC, memoCount, yieldSources };
}

async function fetchYieldData(): Promise<YieldData> {
  console.log('[PERCEIVE] Fetching yield data via x402-gated API...');
  console.log(`[PERCEIVE] Endpoint: ${YIELD_SERVER_URL}/api/yields`);

  // agent/src/agent.ts:61 — wrapFetchWithPayment auto-pays $0.001 USDC on 402
  const response = await fetchWithPay(`${YIELD_SERVER_URL}/api/yields`);

  if (!response.ok) {
    throw new Error(`Yield server returned HTTP ${response.status}`);
  }

  const data = await response.json() as YieldData;
  console.log('[PERCEIVE] Yield data received:');
  for (const src of data.sources) {
    console.log(`  ${src.name}: ${src.aprPct}% APY`);
  }
  return data;
}

// ─── Phase 2: REASON (LLM) ───────────────────────────────────────────────────

const CFO_MEMO_PROMPT = `You are an AI treasury officer for a crypto-native company.
Your job is to analyze the current payroll vault state and yield opportunities, then:
1. Write a concise CFO-readable memo explaining your rebalance decision (3-5 sentences).
2. Recommend specific allocations across yield sources.
3. Flag any risks clearly.

The memo will be published on-chain as part of the company's financial audit trail.
Write in clear, professional financial language — not crypto jargon.

IMPORTANT: Your output must be valid JSON matching this schema:
{
  "memoText": "string — the full CFO memo (3-5 sentences, professional tone)",
  "allocations": [
    {
      "sourceAddress": "0x...",
      "amountUSDC": number,
      "rationale": "string — one-line reason for this allocation"
    }
  ],
  "recommendation": "PROCEED" | "HOLD" | "REVIEW",
  "confidence": number between 0 and 1,
  "risks": ["string — each risk on a separate line"]
}`;

async function generateCFOMemo(
  vaultState: VaultState,
  yieldData: YieldData,
  schedulerInfo?: { nextPayday: Date; totalPayroll: number; employeeCount: number }
): Promise<CFOMemoDecision> {
  console.log('[REASON] Calling LLM to generate CFO memo...');
  console.log(`[REASON] Model: ${LLM_MODEL}`);

  const context = `
VAULT STATE:
- Total assets: $${vaultState.totalAssetsUSDC.toLocaleString()} USDC
- Registered yield sources: ${vaultState.yieldSources.length}
- Previous memos: ${vaultState.memoCount}

YIELD OPPORTUNITIES:
${yieldData.sources.map(s =>
  `- ${s.name} (${s.address}): ${s.aprPct}% APY, $${(s.tvlUSDC / 1e6).toFixed(1)}M TVL, audited: ${s.audited}, risk: ${s.risk}`
).join('\n')}

GAS COST for rebalance: ~$${yieldData.gasEstimateUSDC} USDC

${schedulerInfo ? `
PAYROLL SCHEDULE:
- Next payday: ${schedulerInfo.nextPayday.toDateString()}
- Total payroll: $${schedulerInfo.totalPayroll.toLocaleString()} USDC
- Employees: ${schedulerInfo.employeeCount}
- IMPORTANT: Keep at least 110% of total payroll in liquid/safe allocation
` : ''}

CONSTRAINTS:
- Maximum rebalance: ${MAX_REBALANCE_BPS / 100}% of total assets
- Only pre-approved yield source addresses may receive funds
- Prioritize liquidity preservation 14 days before payday
`;

  // agent/src/agent.ts:88 — LLM call
  const message = await anthropic.messages.create({
    model: LLM_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${CFO_MEMO_PROMPT}\n\nCurrent context:\n${context}\n\nOutput JSON only:`,
      },
    ],
  });

  const rawText = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Parse JSON — strip markdown code fences if present
  const jsonText = rawText
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  const decision = JSON.parse(jsonText) as CFOMemoDecision;

  console.log('[REASON] CFO Memo generated:');
  console.log('─'.repeat(60));
  console.log(decision.memoText);
  console.log('─'.repeat(60));
  console.log(`[REASON] Recommendation: ${decision.recommendation} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
  if (decision.risks.length > 0) {
    console.log('[REASON] Risks:', decision.risks.join('; '));
  }

  return decision;
}

// ─── Phase 3: ACT ────────────────────────────────────────────────────────────

async function commitMemoOnChain(memo: CFOMemoDecision): Promise<`0x${string}`> {
  console.log('[ACT] Committing CFO memo on-chain (emitMemo)...');

  if (!VAULT_ADDRESS) throw new Error('PAYROLL_VAULT_ADDRESS not set');

  const memoHash = keccak256(toHex(memo.memoText));

  const txHash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: PAYROLL_VAULT_ABI,
    functionName: 'emitMemo',
    args: [memoHash, memo.memoText],
  });

  console.log(`[ACT] emitMemo tx: ${txHash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[ACT] Memo confirmed in block ${receipt.blockNumber}`);

  return txHash;
}

async function executeRebalance(
  memo: CFOMemoDecision,
  yieldSources: readonly `0x${string}`[]
): Promise<`0x${string}` | null> {
  if (memo.recommendation !== 'PROCEED') {
    console.log(`[ACT] Rebalance skipped — agent recommendation: ${memo.recommendation}`);
    return null;
  }

  console.log('[ACT] Executing rebalance...');

  if (!VAULT_ADDRESS) throw new Error('PAYROLL_VAULT_ADDRESS not set');

  // Build allocation arrays — filter to only approved sources
  const sources: `0x${string}`[] = [];
  const allocations: bigint[] = [];

  for (const allocation of memo.allocations) {
    const sourceAddr = allocation.sourceAddress.toLowerCase() as `0x${string}`;
    const isApproved = yieldSources.some(s => s.toLowerCase() === sourceAddr);

    if (!isApproved) {
      console.warn(`[ACT] Skipping unapproved source: ${allocation.sourceAddress}`);
      continue;
    }

    sources.push(allocation.sourceAddress as `0x${string}`);
    allocations.push(BigInt(Math.round(allocation.amountUSDC * 1e6)));

    console.log(`[ACT]   ${allocation.sourceAddress}: $${allocation.amountUSDC.toLocaleString()} USDC`);
  }

  if (sources.length === 0) {
    console.log('[ACT] No valid allocations — rebalance skipped');
    return null;
  }

  const txHash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: PAYROLL_VAULT_ABI,
    functionName: 'rebalance',
    args: [sources, allocations],
  });

  console.log(`[ACT] rebalance tx: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`[ACT] Rebalance confirmed in block ${receipt.blockNumber}`);

  return txHash;
}

async function executePayrollCycle(): Promise<void> {
  console.log('[ACT] Starting payroll execution...');

  if (!SCHEDULER_ADDRESS) throw new Error('PAYROLL_SCHEDULER_ADDRESS not set');

  // 1. Check how many employees and their addresses
  const empCount = await publicClient.readContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'employeeCount',
  });

  console.log(`[ACT] Employee count: ${empCount}`);

  const addresses: `0x${string}`[] = [];
  for (let i = 0n; i < empCount; i++) {
    const emp = await publicClient.readContract({
      address: SCHEDULER_ADDRESS,
      abi: PAYROLL_SCHEDULER_ABI,
      functionName: 'getEmployee',
      args: [i],
    });
    if (emp.active) {
      addresses.push(emp.wallet);
    }
  }

  // 2. GoPlus security check for all employee addresses
  // agent/src/agent.ts:142 — GoPlus pre-flight
  console.log('[ACT] Running GoPlus security checks...');
  const securityResults = await checkAllAddresses(addresses, CHAIN_ID);

  // 3. Set security cleared flags on-chain
  for (let i = 0n; i < empCount; i++) {
    const emp = await publicClient.readContract({
      address: SCHEDULER_ADDRESS,
      abi: PAYROLL_SCHEDULER_ABI,
      functionName: 'getEmployee',
      args: [i],
    });

    if (!emp.active) continue;

    const secResult = securityResults.get(emp.wallet.toLowerCase());
    const cleared = secResult?.safe ?? false;

    const flagTx = await walletClient.writeContract({
      address: SCHEDULER_ADDRESS,
      abi: PAYROLL_SCHEDULER_ABI,
      functionName: 'setSecurityCleared',
      args: [i, cleared],
    });

    await publicClient.waitForTransactionReceipt({ hash: flagTx });
    console.log(`[ACT] Employee ${i} (${emp.wallet.slice(0, 10)}…) → cleared: ${cleared}`);
  }

  // 4. Execute payroll
  const isPaydayDue = await publicClient.readContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'isPaydayDue',
  });

  if (!isPaydayDue) {
    const nextPayday = await publicClient.readContract({
      address: SCHEDULER_ADDRESS,
      abi: PAYROLL_SCHEDULER_ABI,
      functionName: 'nextPayday',
    });
    const nextDate = new Date(Number(nextPayday) * 1000);
    console.log(`[ACT] Payday not yet due. Next payday: ${nextDate.toDateString()}`);
    return;
  }

  const payrollTx = await walletClient.writeContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'executePayroll',
  });

  console.log(`[ACT] executePayroll tx: ${payrollTx}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: payrollTx });
  console.log(`[ACT] Payroll executed in block ${receipt.blockNumber}`);

  console.log('\n[DONE] Payroll cycle complete!');
  console.log(`  Tx: ${payrollTx}`);
  console.log(`  Explorer: https://sepolia.basescan.org/tx/${payrollTx}`);
}

// ─── Main Entry Points ───────────────────────────────────────────────────────

export async function runRebalanceCycle(): Promise<void> {
  console.log('\n=== AI-Treasurer Rebalance Cycle ===');
  console.log(`Agent wallet: ${account.address}`);
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log('');

  // PERCEIVE
  const [vaultState, yieldData] = await Promise.all([
    perceiveVaultState(),
    fetchYieldData(),
  ]);

  // REASON
  const memo = await generateCFOMemo(vaultState, yieldData);

  // ACT
  const memoTxHash = await commitMemoOnChain(memo);
  const rebalanceTxHash = await executeRebalance(memo, vaultState.yieldSources);

  console.log('\n=== Rebalance Cycle Complete ===');
  console.log(`  Memo tx:      ${memoTxHash}`);
  console.log(`  Rebalance tx: ${rebalanceTxHash ?? 'skipped'}`);
  console.log(`  Explorer:     https://sepolia.basescan.org/address/${VAULT_ADDRESS}`);
}

export async function runPaydayCycle(): Promise<void> {
  console.log('\n=== AI-Treasurer Payday Cycle ===');
  console.log(`Agent wallet: ${account.address}`);
  console.log(`Scheduler: ${SCHEDULER_ADDRESS}`);
  console.log('');

  await executePayrollCycle();
}

export async function runDemoMode(): Promise<void> {
  console.log('\n=== AI-Treasurer DEMO MODE ===');
  console.log('Running rebalance cycle, then payday cycle...\n');

  await runRebalanceCycle();

  console.log('\nWaiting 3 seconds before payday cycle...\n');
  await new Promise(r => setTimeout(r, 3000));

  await runPaydayCycle();
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode=') || a === '--mode');
  let mode = 'rebalance';

  if (modeArg) {
    if (modeArg.includes('=')) {
      mode = modeArg.split('=')[1];
    } else {
      const idx = args.indexOf('--mode');
      mode = args[idx + 1] ?? 'rebalance';
    }
  }

  switch (mode) {
    case 'rebalance':
      await runRebalanceCycle();
      break;
    case 'payday':
      await runPaydayCycle();
      break;
    case 'demo':
      await runDemoMode();
      break;
    default:
      console.error(`Unknown mode: ${mode}. Use --mode=rebalance|payday|demo`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
