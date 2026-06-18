/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    // Privy 3.x ships Solana wallet support. We are EVM-only on Base Sepolia,
    // so stub the missing Solana system-program package to avoid build errors.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana-program/system': false,
      '@solana-program/compute-budget': false,
      '@solana/web3.js': false,
      '@farcaster/mini-app-solana': false,
    };
    return config;
  },
};

module.exports = nextConfig;
