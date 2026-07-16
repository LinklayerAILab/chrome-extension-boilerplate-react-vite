/**
 * 支付工具函数 - 基于 App.tsx 已有的钱包连接能力
 */
import { parseUnits, encodeFunctionData } from 'viem';
import {
  CHAIN_ID,
  CHAIN_NAME,
  PAYEE_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
  erc20Abi,
  USDT_DECIMAL,
  USDC_DECIMAL,
} from '../config/payment';

const normalizeWeb3ErrorMessage = (errorInput: unknown): string => {
  const extractCoreMessage = (message: string) => {
    const trimmed = message.trim();
    const separatorIndex = trimmed.indexOf(' | ');
    if (separatorIndex > 0) {
      return trimmed.slice(0, separatorIndex).trim();
    }
    return trimmed;
  };

  const parseJson = (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const normalize = (input: unknown): string => {
    if (!input) return 'Unknown error';

    if (typeof input === 'string') {
      const parsed = parseJson(input);
      if (parsed) {
        return normalize(parsed);
      }
      return extractCoreMessage(input);
    }

    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (obj.error) {
        return normalize(obj.error);
      }
      const code = obj.code ?? (obj.data as Record<string, unknown> | undefined)?.code;
      const rawMessage = obj.message;
      const message = extractCoreMessage(
        typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? 'Unknown error'),
      );

      if (code === 4001 || code === '4001') {
        return message || 'User denied request.';
      }

      return message || 'Unknown error';
    }

    return extractCoreMessage(String(input));
  };

  return normalize(errorInput);
};

// 通过 Background Script 在页面上下文执行 eth_* 调用
const executeViaBackgroundScript = async (method: string, args: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'WEB3_REQUEST', method, args }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(normalizeWeb3ErrorMessage(chrome.runtime.lastError.message)));
        return;
      }
      if (response?.error) {
        reject(new Error(normalizeWeb3ErrorMessage(response.error)));
        return;
      }
      if (response?.success && response?.result !== undefined) {
        resolve(response.result);
        return;
      }
      reject(new Error('Invalid response from background script'));
    });
  });
};

// 切换链
export const switchBscChain = async (_targetChainId: number, providerId?: string): Promise<void> => {
  const hexChainId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await executeViaBackgroundScript('wallet_switchEthereumChain', [{ chainId: hexChainId }]);
  } catch {
    // 链不存在，尝试添加
    const chainConfig = {
      chainId: hexChainId,
      chainName: CHAIN_NAME,
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: ['https://bsc-dataseed.binance.org/'],
      blockExplorerUrls: ['https://bscscan.com'],
    };
    await executeViaBackgroundScript('wallet_addEthereumChain', [chainConfig]);
  }
};

// 获取 ERC20 余额
export const getTokenBalance = async (
  tokenAddress: string,
  userAddress: string,
  providerId?: string,
): Promise<bigint> => {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
  });
  const result = await executeViaBackgroundScript('eth_call', [{ to: tokenAddress, data }, 'latest']);
  if (!result || typeof result !== 'string') {
    throw new Error(`Invalid eth_call result: ${JSON.stringify(result)}`);
  }
  if (result === '0x') {
    return 0n;
  }
  return BigInt(result);
};

// 执行 ERC20 transfer
export const executeTransfer = async (
  tokenAddress: string,
  payeeAddress: string,
  amount: string, // 人类可读的美元金额，如 "9.9"
  decimal: number,
  userAddress: string,
  providerId?: string,
): Promise<string> => {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [payeeAddress as `0x${string}`, parseUnits(amount, decimal)],
  });
  const txHash = await executeViaBackgroundScript('eth_sendTransaction', [
    {
      from: userAddress,
      to: tokenAddress,
      data,
    },
  ]);
  return txHash;
};

// 获取配置
export const getPayConfig = (_isDev: boolean) => {
  return {
    chainId: CHAIN_ID,
    payeeAddress: PAYEE_ADDRESS,
    tokens: {
      usdt: {
        address: USDT_ADDRESS,
        decimal: USDT_DECIMAL,
        label: 'USDT',
      },
      usdc: {
        address: USDC_ADDRESS,
        decimal: USDC_DECIMAL,
        label: 'USDC',
      },
    },
  };
};
