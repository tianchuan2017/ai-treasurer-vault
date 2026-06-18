/**
 * security.ts
 * GoPlus address security pre-flight check.
 * Called before every payroll disbursement to flag malicious addresses.
 *
 * API docs: https://docs.gopluslabs.io/reference/get_address_security
 * Declared external endpoint for CertiK Skill Scanner compliance:
 *   https://api.gopluslabs.io
 */

const GOPLUS_API = 'https://api.gopluslabs.io'; // declared endpoint

export interface SecurityResult {
  address: string;
  safe: boolean;
  malicious: boolean;
  reason?: string;
}

/**
 * Check a single address against GoPlus malicious address database.
 * Returns safe=true only when GoPlus confirms no malicious flags.
 * On API error, defaults to safe=false (fail-closed).
 *
 * @param address  The 0x-prefixed wallet address to check.
 * @param chainId  The EVM chain ID (84532 = Base Sepolia, 8453 = Base mainnet).
 */
export async function checkAddressSecurity(
  address: string,
  chainId: number
): Promise<SecurityResult> {
  const url = `${GOPLUS_API}/api/v1/address_security/${address}?chain_id=${chainId}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8_000), // 8-second timeout
    });

    if (!response.ok) {
      console.warn(`[GoPlus] HTTP ${response.status} for ${address} — defaulting to unsafe`);
      return { address, safe: false, malicious: false, reason: `GoPlus HTTP ${response.status}` };
    }

    const data = await response.json() as {
      code: number;
      message: string;
      result?: {
        malicious_address?: string;  // "1" = malicious
        malicious_type?: string;
      };
    };

    if (data.code !== 1 || !data.result) {
      // GoPlus returned a non-success code — treat as unknown
      console.warn(`[GoPlus] Non-success code ${data.code} for ${address}`);
      return { address, safe: false, malicious: false, reason: `GoPlus code ${data.code}` };
    }

    const isMalicious = data.result.malicious_address === '1';

    return {
      address,
      safe: !isMalicious,
      malicious: isMalicious,
      reason: isMalicious ? `GoPlus malicious_type: ${data.result.malicious_type ?? 'unknown'}` : undefined,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[GoPlus] Request failed for ${address}: ${message} — defaulting to unsafe`);
    // Fail-closed: if we can't check, do not pay.
    return { address, safe: false, malicious: false, reason: `GoPlus request failed: ${message}` };
  }
}

/**
 * Bulk security check for all employees.
 * Returns a map of address -> SecurityResult.
 */
export async function checkAllAddresses(
  addresses: string[],
  chainId: number
): Promise<Map<string, SecurityResult>> {
  const results = new Map<string, SecurityResult>();

  // Sequential to avoid rate limiting (GoPlus free tier: ~3 req/s)
  for (const address of addresses) {
    const result = await checkAddressSecurity(address, chainId);
    results.set(address.toLowerCase(), result);
    console.log(
      `[GoPlus] ${address.slice(0, 10)}… — ${result.safe ? '✅ Clean' : '❌ Flagged'}`
      + (result.reason ? ` (${result.reason})` : '')
    );
    // Polite pause
    await new Promise(r => setTimeout(r, 400));
  }

  return results;
}
