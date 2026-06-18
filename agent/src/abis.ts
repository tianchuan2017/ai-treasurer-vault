// Minimal ABIs for the contracts we interact with.
// Generated from contract source — matches the deployed bytecode.

export const PAYROLL_VAULT_ABI = [
  // Read
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
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
    name: 'asset',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  // Write
  {
    name: 'emitMemo',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'memoHash', type: 'bytes32' },
      { name: 'ipfsCid',  type: 'string'  },
    ],
    outputs: [{ name: 'memoId', type: 'uint256' }],
  },
  {
    name: 'rebalance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sources',     type: 'address[]' },
      { name: 'allocations', type: 'uint256[]' },
    ],
    outputs: [],
  },
  // Events
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
  {
    name: 'Rebalanced',
    type: 'event',
    inputs: [
      { name: 'memoId',      type: 'uint256',   indexed: true  },
      { name: 'sources',     type: 'address[]', indexed: false },
      { name: 'allocations', type: 'uint256[]', indexed: false },
      { name: 'totalMoved',  type: 'uint256',   indexed: false },
    ],
  },
] as const;

export const PAYROLL_SCHEDULER_ABI = [
  // Read
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
  {
    name: 'getEmployee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'wallet',          type: 'address' },
          { name: 'salaryAmount',    type: 'uint256' },
          { name: 'active',          type: 'bool'    },
          { name: 'securityCleared', type: 'bool'    },
          { name: 'lastPaid',        type: 'uint256' },
        ],
      },
    ],
  },
  // Write
  {
    name: 'setSecurityCleared',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id',      type: 'uint256' },
      { name: 'cleared', type: 'bool'    },
    ],
    outputs: [],
  },
  {
    name: 'executePayroll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: 'PayrollExecuted',
    type: 'event',
    inputs: [
      { name: 'cycleNumber',      type: 'uint256', indexed: true  },
      { name: 'totalDistributed', type: 'uint256', indexed: false },
      { name: 'employeesCount',   type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'SalaryPaid',
    type: 'event',
    inputs: [
      { name: 'employeeId', type: 'uint256', indexed: true  },
      { name: 'wallet',     type: 'address', indexed: true  },
      { name: 'amount',     type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value',   type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
