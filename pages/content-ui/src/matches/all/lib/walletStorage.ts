/**
 * 钱包状态存储工具
 * 使用 chrome.storage 持久化钱包连接状态
 */

export type WalletState = {
  isConnected: boolean;
  address: string | null;
  chainId: string | null;
  lastConnected: number; // 时间戳
  providerId?: string; // provider 的唯一标识，用于检测 MetaMask 重启
};

const WALLET_STORAGE_KEY = '@Linklayerai/wallet_state';

/**
 * 保存钱包状态到 storage
 */
export async function saveWalletState(state: WalletState): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [WALLET_STORAGE_KEY]: state }, () => {
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
    chrome.storage.local.get([WALLET_STORAGE_KEY], result => {
      const state = result[WALLET_STORAGE_KEY] || {
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
 * 清除钱包状态
 */
export async function clearWalletState(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([WALLET_STORAGE_KEY], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('[Wallet Storage] Cleared wallet state');
        resolve();
      }
    });
  });
}
