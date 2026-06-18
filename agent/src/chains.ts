import { defineChain } from 'viem';
import { baseSepolia, base } from 'viem/chains';

export { baseSepolia, base };

// Re-export with our naming convention
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_MAINNET_CHAIN_ID = 8453;

// USDC addresses
export const USDC_ADDRESS: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_CHAIN_ID]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [BASE_MAINNET_CHAIN_ID]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

// x402 CAIP-2 network identifiers
export const X402_NETWORK: Record<number, string> = {
  [BASE_SEPOLIA_CHAIN_ID]: 'eip155:84532',
  [BASE_MAINNET_CHAIN_ID]: 'eip155:8453',
};
