const IS_DEV = process.env.CLI_CEB_DEV === 'true';

export const LLAX_TOKEN_CONTRACT_ADDRESS = IS_DEV
  ? (process.env.CEB_LLAX_TOKEN_CONTRACT_TESTNET ?? '0x29A32C8BC3934D987477984e573f5B398B8f3D4C')
  : (process.env.CEB_LLAX_TOKEN_CONTRACT ?? '0x19d271F66EA192125d013f3826C59B5583c9950e');

export const LLAX_CLAIM_CONTRACT_ADDRESS = IS_DEV
  ? (process.env.CEB_LLAX_CLAIM_CONTRACT_TESTNET ?? '0x29A32C8BC3934D987477984e573f5B398B8f3D4C')
  : (process.env.CEB_LLAX_CLAIM_CONTRACT ?? '0x19d271F66EA192125d013f3826C59B5583c9950e');

export const llaxClaimAbi = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalClaimed',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'globalTotalClaimed',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_CLAIM_AMOUNT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'nonce', type: 'bytes32' },
      { indexed: false, name: 'claimCount', type: 'uint256' },
    ],
    name: 'Claimed',
    type: 'event',
  },
] as const;
