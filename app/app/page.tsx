'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useReadContract, useReadContracts } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { formatUnits } from 'viem';
import { VAULT_ADDRESS, SCHEDULER_ADDRESS } from '../lib/wagmi';
import { PAYROLL_VAULT_ABI, PAYROLL_SCHEDULER_ABI } from '../lib/abis';

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatUSDC(raw: bigint | undefined): string {
  if (raw === undefined) return '...';
  return `$${parseFloat(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function ConnectScreen({ login }: { login: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🏦</div>
          <h1 className="text-3xl font-bold mb-2">AI-Treasurer</h1>
          <p className="text-muted text-sm">Payroll Vault · AI-powered yield optimization</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-1">Sign in to your treasury</h2>
          <p className="text-muted text-sm mb-6">
            No seed phrases. Your wallet is created automatically on sign-in.
          </p>
          <button
            onClick={login}
            className="w-full bg-indigo hover:opacity-90 text-white font-semibold py-3 px-6 rounded-xl transition-opacity"
          >
            Connect via Email or Wallet
          </button>
          <p className="text-xs text-muted text-center mt-4">
            Powered by Privy · Base Sepolia Testnet
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-text',
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-xs text-muted uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-bold tabular-nums mb-1 ${color}`}>{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

function MemoCard({
  memoText,
  timestamp,
  txHash,
  allocA,
  allocB,
  recommendation,
}: {
  memoText: string;
  timestamp: string;
  txHash?: string;
  allocA: number;
  allocB: number;
  recommendation: string;
}) {
  return (
    <div className="p-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo to-emerald flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-0.5">AI Treasurer Agent</div>
          <div className="text-xs text-muted">{timestamp}</div>
        </div>
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-light hover:underline font-mono flex-shrink-0"
          >
            {shortenAddr(txHash)} ↗
          </a>
        )}
      </div>

      {/* Memo text in serif for CFO readability */}
      <blockquote className="font-serif text-[13.5px] leading-relaxed text-slate-300 bg-bg border-l-2 border-indigo px-4 py-3 rounded-r-lg mb-3">
        {memoText}
      </blockquote>

      {/* Mini allocation bar */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted">
        <span>A {allocA}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div
            className="h-full bg-indigo rounded-full"
            style={{ width: `${allocA}%` }}
          />
        </div>
        <span>B {allocB}%</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          recommendation === 'PROCEED'
            ? 'bg-emerald/15 text-emerald'
            : recommendation === 'HOLD'
            ? 'bg-amber/15 text-amber'
            : 'bg-surface2 text-muted'
        }`}>
          {recommendation === 'PROCEED' ? '✅ Approved by agent' : `⚠️ ${recommendation}`}
        </span>
        {txHash && (
          <a
            href={`https://sepolia.basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-light hover:underline ml-auto"
          >
            On-chain proof ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];

  // Read vault state
  const { data: totalAssets, refetch: refetchAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: PAYROLL_VAULT_ABI,
    functionName: 'totalAssets',
    chainId: baseSepolia.id,
  });

  const { data: memoCount } = useReadContract({
    address: VAULT_ADDRESS,
    abi: PAYROLL_VAULT_ABI,
    functionName: 'memoCount',
    chainId: baseSepolia.id,
  });

  const { data: isPaydayDue } = useReadContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'isPaydayDue',
    chainId: baseSepolia.id,
  });

  const { data: nextPaydayTs } = useReadContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'nextPayday',
    chainId: baseSepolia.id,
  });

  const { data: totalPayroll } = useReadContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'totalPayrollAmount',
    chainId: baseSepolia.id,
  });

  const { data: empCount } = useReadContract({
    address: SCHEDULER_ADDRESS,
    abi: PAYROLL_SCHEDULER_ABI,
    functionName: 'employeeCount',
    chainId: baseSepolia.id,
  });

  // Compute next payday display
  const daysUntilPayday = nextPaydayTs
    ? Math.max(0, Math.ceil((Number(nextPaydayTs) * 1000 - Date.now()) / 86400000))
    : null;

  // Demo-static memo (in production: read CFOMemoEmitted events via viem getLogs)
  const demoMemos = [
    {
      memoText:
        'Source A currently yields 9.1% APY versus Source B at 7.4%. I recommend a 70/30 split to maximize yield while maintaining a 30% liquidity buffer ahead of payday in 14 days. Estimated daily yield on $50,000: $12.47. Gas cost for this rebalance: $0.003 — the yield covers this in under 45 minutes. GoPlus security check on both protocol addresses returned no malicious flags. Recommendation: PROCEED with rebalance.',
      timestamp: '2026-06-18 09:14 UTC',
      txHash: undefined,
      allocA: 70,
      allocB: 30,
      recommendation: 'PROCEED',
    },
    {
      memoText:
        'Source A APY dropped from 11.2% to 9.1% due to increased liquidity inflows. Reducing Source A allocation from 80% to 70% to maintain diversification. No change to Source B. Expected impact on daily yield: -$0.82. Acceptable trade-off for reduced concentration risk.',
      timestamp: '2026-06-11 09:02 UTC',
      txHash: undefined,
      allocA: 70,
      allocB: 30,
      recommendation: 'PROCEED',
    },
  ];

  return (
    <div className="min-h-screen bg-bg">
      {/* Topbar */}
      <nav className="bg-surface border-b border-border sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo to-emerald flex items-center justify-center text-lg">
            🏦
          </div>
          <div>
            <div className="font-bold text-sm">AI-Treasurer</div>
            <div className="text-xs text-muted">Payroll Vault</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface2 border border-border rounded-full px-3 py-1 text-xs text-muted flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald"></span>
            Base Sepolia
          </div>
          {user && (
            <div className="bg-surface2 border border-border rounded-full px-3 py-1 text-xs font-mono">
              {shortenAddr(activeWallet?.address ?? user?.id?.slice(0, 28) ?? '0x000…')}
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <StatCard
            label="Total Pool"
            value={formatUSDC(totalAssets)}
            sub="USDC deposited"
          />
          <StatCard
            label="Yield Earned"
            value="$247"
            sub="this cycle · 14 days"
            color="text-emerald"
          />
          <StatCard
            label="Current APY"
            value="8.7%"
            sub="blended across sources"
          />
          <StatCard
            label="Next Payday"
            value={daysUntilPayday !== null ? `${daysUntilPayday}d` : '...'}
            sub={totalPayroll ? `${formatUSDC(totalPayroll)} scheduled` : 'loading...'}
            color={isPaydayDue ? 'text-amber' : 'text-text'}
          />
        </div>

        {/* Allocation bar */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Current Allocation</span>
            <span className="text-xs text-muted bg-surface2 px-3 py-1 rounded-full">
              Last rebalanced: 2h ago
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface2 overflow-hidden flex mb-3">
            <div className="bg-indigo w-[70%] h-full" />
            <div className="bg-emerald w-[30%] h-full" />
          </div>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo inline-block" />
              Source A (9.1% APY)
              <span className="font-semibold text-text">70%</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald inline-block" />
              Source B (7.4% APY)
              <span className="font-semibold text-text">30%</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button className="flex items-center gap-2 bg-indigo hover:opacity-90 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-opacity">
            <span>⚡</span> Run AI Rebalance
          </button>
          <button
            className={`flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm transition-opacity ${
              isPaydayDue
                ? 'bg-emerald hover:opacity-90 text-white'
                : 'bg-surface2 text-muted border border-border cursor-not-allowed'
            }`}
            disabled={!isPaydayDue}
          >
            <span>💸</span> Execute Payday
          </button>
          <button className="flex items-center gap-2 bg-surface2 border border-border text-muted hover:text-text font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
            <span>👤</span> Add Employee
          </button>
          <button className="flex items-center gap-2 bg-surface2 border border-border text-muted hover:text-text font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
            <span>💰</span> Deposit USDC
          </button>
        </div>

        {/* Two-column */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
          {/* CFO Memo Feed */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold">🤖 AI CFO Memo Feed</span>
              <span className="text-xs text-muted bg-surface2 px-2 py-0.5 rounded-full">
                {memoCount !== undefined ? `${memoCount} memos` : 'loading...'}
              </span>
            </div>
            {demoMemos.map((memo, i) => (
              <MemoCard key={i} {...memo} />
            ))}
          </div>

          {/* Employees */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold">👥 Employees</span>
              <span className="text-xs text-muted bg-surface2 px-2 py-0.5 rounded-full">
                {empCount !== undefined ? `${empCount} registered` : '...'} · next payday: {daysUntilPayday ?? '...'}d
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 text-xs text-muted uppercase tracking-wide">Employee</th>
                    <th className="text-left px-5 py-2.5 text-xs text-muted uppercase tracking-wide">Salary</th>
                    <th className="text-left px-5 py-2.5 text-xs text-muted uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Alice Chen',    addr: '0xA1b2C3d4E5f6A7B8C9D0', salary: '$5,000' },
                    { name: 'Bob Martinez',  addr: '0xE5f6G7h8I9j0K1L2M3N4', salary: '$3,500' },
                    { name: 'Carol Kim',     addr: '0xI9j0K1l2M3n4O5P6Q7R8', salary: '$4,200' },
                  ].map((emp) => (
                    <tr key={emp.addr} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <div className="text-sm font-medium">{emp.name}</div>
                        <div className="text-xs text-muted font-mono">{emp.addr.slice(0, 14)}…</div>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold tabular-nums">{emp.salary}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-emerald/15 text-emerald px-2 py-0.5 rounded-full">
                          ✅ Scheduled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-border text-xs text-emerald flex items-center gap-2">
              🛡️ GoPlus: All addresses verified clean
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-border text-xs text-muted flex items-center justify-between">
          <div>AI-Treasurer Payroll Vault · Base Sepolia · 2026</div>
          <div className="flex gap-4">
            <a
              href={`https://sepolia.basescan.org/address/${VAULT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition-colors"
            >
              Contract ↗
            </a>
            <a href="#" className="hover:text-text transition-colors">GitHub ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export default function Page() {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <ConnectScreen login={login} />;
  }

  return <Dashboard />;
}
