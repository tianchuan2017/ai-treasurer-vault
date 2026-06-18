import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org'
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC ?? 'https://mainnet.base.org'
    ),
  },
  ssr: true,
});

// Contract addresses — populated after deploy
export const VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_PAYROLL_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

export const SCHEDULER_ADDRESS = (
  process.env.NEXT_PUBLIC_PAYROLL_SCHEDULER_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

// Base Sepolia USDC
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
