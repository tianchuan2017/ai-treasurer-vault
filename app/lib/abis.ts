// Minimal ABIs for frontend usage

export const PAYROLL_VAULT_ABI = [
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'memoCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getYieldSources',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getSourceBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'source', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'trustedAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'CFOMemoEmitted',
    type: 'event',
    inputs: [
      { name: 'memoId',    type: 'uint256', indexed: true  },
      { name: 'memoHash',  type: 'bytes32', indexed: true  },
      { name: 'ipfsCid',   type: 'string',  indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const PAYROLL_SCHEDULER_ABI = [
  {
    name: 'isPaydayDue',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nextPayday',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalPayrollAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'total', type: 'uint256' }],
  },
  {
    name: 'employeeCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
