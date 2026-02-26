import { http, createConfig } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// 公共 RPC 端点
const RPC_URLS = {
  1: 'https://eth.llamarpc.com',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  8453: 'https://mainnet.base.org',
} as const;

// 创建 Wagmi 配置
export const web3Config = () => {
  // 确保 window 和 ethereum 存在
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    console.warn('[Wagmi] window.ethereum not available, using SSR mode');
  }

  return createConfig({
    chains: [mainnet, polygon, arbitrum, optimism, base] as const,
    connectors: [
      injected({
        target: 'metaMask',
      }),
    ],
    transports: {
      [mainnet.id]: http(RPC_URLS[1]),
      [polygon.id]: http(RPC_URLS[137]),
      [arbitrum.id]: http(RPC_URLS[42161]),
      [optimism.id]: http(RPC_URLS[10]),
      [base.id]: http(RPC_URLS[8453]),
    },
    ssr: true, // 使用 SSR 模式避免 Content Script 存储问题
    // 添加配置以减少初始化检查
    pollingInterval: 30000,
  });
};
