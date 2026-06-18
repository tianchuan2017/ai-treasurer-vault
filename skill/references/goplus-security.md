# GoPlus Security Integration Reference

## Overview

Before executing payroll, the AI agent runs every active employee wallet address
through the GoPlus Security API. Any address flagged as malicious is marked
`securityCleared = false` in the PayrollScheduler contract. The `executePayroll()`
function skips (does not revert on) uncleaned addresses, preventing a single
compromised wallet from blocking the entire team's payday.

## API Call (`agent/src/security.ts`)

```typescript
const url = `https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${chainId}`;
const response = await axios.get(url, { timeout: 5000 });
```

### Response Schema (simplified)

```json
{
  "code": 1,
  "result": {
    "is_contract": "0",
    "malicious_behavior": [],
    "phishing_activities": "0",
    "blacklist_doubt": "0",
    "data_source": "GoPlus",
    "honeypot_related_address": "0",
    "cybercrime": "0",
    "money_laundering": "0",
    "other_malicious": "0",
    "sanctioned": "0"
  }
}
```

## Fail-Closed Behavior

The integration is explicitly **fail-closed**:

```typescript
// Any error → safe = false (blocks payroll for that address)
} catch (error) {
  return { address, safe: false, malicious: false, reason: 'API error — fail closed' };
}
```

If the GoPlus API is unreachable, returns USDC is NOT sent to that address.
Finance teams can override via manual `setSecurityCleared()` call from owner.

## Rate Limiting

The free GoPlus tier has no documented hard rate limit but recommends < 5 req/sec.
The agent uses **sequential calls with 400ms pause** between addresses:

```typescript
for (const address of addresses) {
  const result = await checkAddressSecurity(address, chainId);
  results.set(address, result);
  await new Promise(r => setTimeout(r, 400));  // 400ms pause
}
```

For 10 employees: ~4 seconds total. Acceptable before a $50K payroll run.

## On-Chain Record

After GoPlus check, the agent calls `setSecurityCleared()` per employee:

```solidity
function setSecurityCleared(uint256 id, bool cleared) external onlyAgent {
    employees[id].securityCleared = cleared;
    emit SecurityClearedUpdated(id, cleared);
}
```

This creates an immutable on-chain record of which addresses were security-cleared
before each payroll run. Combined with the CFO memo audit trail, the system
provides full pre-execution documentation.

## Chain ID Mapping

| Network | GoPlus Chain ID |
|---|---|
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |
| Ethereum | 1 |

GoPlus natively supports Base chain IDs.
