/**
 * 支付配置 - BSC 链 + USDT/USDC 代币地址
 * 构建时通过 Vite define 注入环境变量
 */

// 注意：CEB_ENV 由 Vite define 注入（dev / test / prod）。
// 不能用 CLI_CEB_DEV —— build:test 是生产形态但要走测试网合约。
const ENV_PRESET = process.env.CEB_ENV ?? 'prod';
const IS_TEST_ENV = ENV_PRESET !== 'prod';

// BSC 链 ID
export const CHAIN_ID = Number(process.env.CEB_CHAIN_ID ?? (IS_TEST_ENV ? 97 : 56));

// BSC 链名称
export const CHAIN_NAME =
  process.env.CEB_CHAIN_NAME ?? (IS_TEST_ENV ? 'BNB Smart Chain Testnet' : 'Binance Smart Chain');

// 收款地址
export const PAYEE_ADDRESS = process.env.CEB_PAYEE_ADDRESS ?? '';

// USDT 合约地址
export const USDT_ADDRESS = process.env.CEB_USDT_ADDRESS ?? '';

// USDC 合约地址
export const USDC_ADDRESS = process.env.CEB_USDC_ADDRESS ?? '';

// 代币小数位
export const USDT_DECIMAL = Number(process.env.CEB_USDT_DECIMAL ?? (IS_TEST_ENV ? 18 : 18));

export const USDC_DECIMAL = Number(process.env.CEB_USDC_DECIMAL ?? (IS_TEST_ENV ? 6 : 18));

// ERC20 ABI（仅需要的最小接口）
export const erc20Abi = [
  {
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
