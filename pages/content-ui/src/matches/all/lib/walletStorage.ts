/**
 * 钱包状态存储工具
 * 使用 chrome.storage 持久化钱包连接状态
 */

import { LAST_PROVIDER_KEY, WALLET_STATE_KEY } from '@src/lib/storageKeys';

export type WalletState = {
  isConnected: boolean;
  address: string | null;
  chainId: string | null;
  lastConnected: number; // 时间戳
  providerId?: string; // provider 的唯一标识，用于检测 MetaMask 重启
};

/**
 * 保存钱包状态到 storage
 */
export async function saveWalletState(state: WalletState): Promise<void> {
  return new Promise((resolve, reject) => {
    const items: Record<string, unknown> = { [WALLET_STATE_KEY]: state };
    // 记住最后使用的 provider，钱包锁定/断开后仍可用于重连
    if (state.providerId) {
      items[LAST_PROVIDER_KEY] = state.providerId;
    }
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('[Wallet Storage] Saved wallet state:', state);
        resolve();
      }
    });
  });
}

/**
 * 从 storage 读取钱包状态
 */
export async function loadWalletState(): Promise<WalletState> {
  return new Promise(resolve => {
    chrome.storage.local.get([WALLET_STATE_KEY], result => {
      const state = result[WALLET_STATE_KEY] || {
        isConnected: false,
        address: null,
        chainId: null,
        lastConnected: 0,
      };
      console.log('[Wallet Storage] Loaded wallet state:', state);
      resolve(state);
    });
  });
}

/**
 * 读取最后使用的钱包 provider 标识（跨断开/锁定存活）
 */
export async function getLastProviderId(): Promise<string | undefined> {
  return new Promise(resolve => {
    chrome.storage.local.get([LAST_PROVIDER_KEY], result => {
      resolve(result[LAST_PROVIDER_KEY] as string | undefined);
    });
  });
}

/**
 * 清除钱包状态
 * 注意：不删除 LAST_PROVIDER_KEY，重连时需要它定位原钱包
 */
export async function clearWalletState(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([WALLET_STATE_KEY], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('[Wallet Storage] Cleared wallet state');
        resolve();
      }
    });
  });
}
