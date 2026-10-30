export const HONORARIOS_ABI = [
  // ── errors ──────────────────────────────────────────────────────────────────
  { type: 'error', name: 'TaxRateTooHigh', inputs: [] },
  { type: 'error', name: 'InvalidUtcOffset', inputs: [] },
  { type: 'error', name: 'NoProfile', inputs: [] },
  { type: 'error', name: 'EmptyRef', inputs: [] },
  { type: 'error', name: 'RefTooLong', inputs: [] },
  { type: 'error', name: 'ConceptTooLong', inputs: [] },
  { type: 'error', name: 'InvalidAmount', inputs: [] },
  { type: 'error', name: 'ReceiptExists', inputs: [] },
  { type: 'error', name: 'UnknownReceipt', inputs: [] },
  { type: 'error', name: 'AlreadyPaid', inputs: [] },
  { type: 'error', name: 'WrongAmount', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  { type: 'error', name: 'InsufficientReserve', inputs: [] },

  // ── events ───────────────────────────────────────────────────────────────────
  {
    type: 'event', name: 'ProfileSet',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'taxBps', type: 'uint16', indexed: false },
      { name: 'utcOffsetMin', type: 'int16', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Issued',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'refHash', type: 'bytes32', indexed: true },
      { name: 'ref', type: 'string', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'taxBps', type: 'uint16', indexed: false },
      { name: 'utcOffsetMin', type: 'int16', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Paid',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'refHash', type: 'bytes32', indexed: true },
      { name: 'ref', type: 'string', indexed: false },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'net', type: 'uint256', indexed: false },
      { name: 'reserve', type: 'uint256', indexed: false },
      { name: 'period', type: 'uint256', indexed: false },
      { name: 'netSent', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event', name: 'NetDeferred',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'refHash', type: 'bytes32', indexed: true },
      { name: 'net', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ReserveWithdrawn',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'NetClaimed',
    inputs: [
      { name: 'freelancer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },

  // ── write functions ──────────────────────────────────────────────────────────
  {
    type: 'function', name: 'setProfile', stateMutability: 'nonpayable',
    inputs: [
      { name: 'taxBps', type: 'uint16' },
      { name: 'utcOffsetMin', type: 'int16' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'issue', stateMutability: 'nonpayable',
    inputs: [
      { name: 'ref', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'concept', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'pay', stateMutability: 'payable',
    inputs: [
      { name: 'freelancer', type: 'address' },
      { name: 'ref', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'withdrawReserve', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'claimNet', stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  // ── view functions ───────────────────────────────────────────────────────────
  {
    type: 'function', name: 'profileOf', stateMutability: 'view',
    inputs: [{ name: 'freelancer', type: 'address' }],
    outputs: [
      { name: 'taxBps', type: 'uint16' },
      { name: 'utcOffsetMin', type: 'int16' },
      { name: 'isSet', type: 'bool' },
    ],
  },
  {
    type: 'function', name: 'receiptOf', stateMutability: 'view',
    inputs: [
      { name: 'freelancer', type: 'address' },
      { name: 'ref', type: 'string' },
    ],
    outputs: [
      {
        name: '', type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'taxBps', type: 'uint16' },
          { name: 'utcOffsetMin', type: 'int16' },
          { name: 'issuedAt', type: 'uint40' },
          { name: 'paid', type: 'bool' },
          { name: 'payer', type: 'address' },
          { name: 'paidAt', type: 'uint40' },
          { name: 'concept', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function', name: 'receiptCount', stateMutability: 'view',
    inputs: [{ name: 'freelancer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'receiptRefAt', stateMutability: 'view',
    inputs: [
      { name: 'freelancer', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', name: 'reserveOf', stateMutability: 'view',
    inputs: [{ name: 'freelancer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'pendingNet', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'monthGross', stateMutability: 'view',
    inputs: [
      { name: 'freelancer', type: 'address' },
      { name: 'period', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'currentPeriod', stateMutability: 'view',
    inputs: [{ name: 'freelancer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'periodOf', stateMutability: 'pure',
    inputs: [
      { name: 'timestamp', type: 'uint256' },
      { name: 'utcOffsetMin', type: 'int16' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'totalLiabilities', stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'profiles', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'taxBps', type: 'uint16' },
      { name: 'utcOffsetMin', type: 'int16' },
      { name: 'isSet', type: 'bool' },
    ],
  },
] as const
