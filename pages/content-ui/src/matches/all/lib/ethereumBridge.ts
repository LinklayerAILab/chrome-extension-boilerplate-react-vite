/**
 * Ethereum Bridge API
 *
 * Content Script 端的 API，用于与注入的桥接脚本通信
 */

interface EthereumBridgeRequest {
  type: 'ETHEREUM_BRIDGE_REQUEST';
  action: string;
  id: string;
  data?: any;
}

interface EthereumBridgeResponse {
  type: 'ETHEREUM_BRIDGE_RESPONSE';
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

interface EthereumBridgeEvent {
  type: 'ETHEREUM_BRIDGE_EVENT';
  event: string;
  data: any;
}

type EthereumBridgeEventHandler = (data: any) => void;

// 生成唯一 ID
const generateId = () => `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

// 存储待处理的请求
const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

// 存储事件监听器
const eventListeners = new Map<string, Set<EthereumBridgeEventHandler>>();

// 桥接脚本是否已注入
let isBridgeInjected = false;

/**
 * 初始化以太坊桥接
 * 向页面注入桥接脚本（使用 Blob URL 避免 CSP 问题）
 */
export async function initEthereumBridge(): Promise<boolean> {
  if (isBridgeInjected) {
    return true;
  }

  try {
    // 桥接脚本代码
    const bridgeScriptCode = `
      (function() {
        'use strict';

        console.log('[Ethereum Bridge] Initializing in page context...');

        // 检查 ethereum 是否存在
        if (typeof window.ethereum === 'undefined') {
          console.warn('[Ethereum Bridge] No ethereum provider found');
          return;
        }

        console.log('[Ethereum Bridge] Ethereum provider found:', {
          isMetaMask: window.ethereum.isMetaMask,
          chainId: window.ethereum.chainId,
          selectedAddress: window.ethereum.selectedAddress,
        });

        // 监听来自 Content Script 的消息
        window.addEventListener('message', async (event) => {
          if (event.source !== window) return;
          const { type, action, id, data } = event.data;
          if (type !== 'ETHEREUM_BRIDGE_REQUEST') return;

          console.log('[Ethereum Bridge] Received request:', action, data);

          try {
            let result;

            switch (action) {
              case 'check':
                result = {
                  exists: true,
                  isMetaMask: !!window.ethereum.isMetaMask,
                  chainId: window.ethereum.chainId,
                  selectedAddress: window.ethereum.selectedAddress,
                  isConnected: window.ethereum.isConnected?.() || false,
                };
                break;

              case 'requestAccounts':
                result = await window.ethereum.request({ method: 'eth_requestAccounts' });
                break;

              case 'getAccounts':
                result = await window.ethereum.request({ method: 'eth_accounts' });
                break;

              case 'getChainId':
                result = await window.ethereum.request({ method: 'eth_chainId' });
                break;

              default:
                throw new Error(\`Unknown action: \${action}\`);
            }

            console.log('[Ethereum Bridge] Sending response:', id, result);

            window.postMessage({
              type: 'ETHEREUM_BRIDGE_RESPONSE',
              id,
              success: true,
              result,
            }, '*');

          } catch (error) {
            console.error('[Ethereum Bridge] Error:', error);

            window.postMessage({
              type: 'ETHEREUM_BRIDGE_RESPONSE',
              id,
              success: false,
              error: error.message || 'Unknown error',
            }, '*');
          }
        });

        // 监听 MetaMask 事件并转发给 Content Script
        const forwardEvent = (eventType, data) => {
          console.log('[Ethereum Bridge] Forwarding event:', eventType, data);
          window.postMessage({
            type: 'ETHEREUM_BRIDGE_EVENT',
            event: eventType,
            data,
          }, '*');
        };

        if (window.ethereum.on) {
          window.ethereum.on('accountsChanged', (accounts) => {
            forwardEvent('accountsChanged', { accounts });
          });

          window.ethereum.on('chainChanged', (chainId) => {
            forwardEvent('chainChanged', { chainId });
          });

          window.ethereum.on('connect', (connectInfo) => {
            forwardEvent('connect', connectInfo);
          });

          window.ethereum.on('disconnect', (error) => {
            forwardEvent('disconnect', { error: error?.message });
          });
        }

        console.log('[Ethereum Bridge] Initialized successfully');
      })();
    `;

    // 使用 Blob URL 避免 CSP 问题
    const blob = new Blob([bridgeScriptCode], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    // 创建 script 元素
    const script = document.createElement('script');
    script.src = blobUrl;

    // 等待脚本加载并执行
    await new Promise<void>((resolve, reject) => {
      script.onload = () => {
        console.log('[Ethereum Bridge API] Bridge script loaded');
        URL.revokeObjectURL(blobUrl); // 清理 Blob URL
        resolve();
      };
      script.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load bridge script'));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    // 等待脚本初始化
    await new Promise<void>(resolve => {
      setTimeout(resolve, 100);
    });

    isBridgeInjected = true;

    // 监听桥接脚本的响应
    window.addEventListener('message', handleBridgeMessage);

    // 监听桥接脚本的事件
    window.addEventListener('message', handleBridgeEvent);

    console.log('[Ethereum Bridge API] Initialized');
    return true;
  } catch (error) {
    console.error('[Ethereum Bridge API] Failed to initialize:', error);
    return false;
  }
}

/**
 * 处理来自桥接脚本的响应
 */
function handleBridgeMessage(event: MessageEvent) {
  if (event.source !== window) return;
  if (event.data.type !== 'ETHEREUM_BRIDGE_RESPONSE') return;

  const response = event.data as EthereumBridgeResponse;
  const { id, success, result, error } = response;

  const pending = pendingRequests.get(id);
  if (!pending) return;

  pendingRequests.delete(id);

  if (success) {
    pending.resolve(result);
  } else {
    pending.reject(new Error(error || 'Unknown error'));
  }
}

/**
 * 处理来自桥接脚本的事件
 */
function handleBridgeEvent(event: MessageEvent) {
  if (event.source !== window) return;
  if (event.data.type !== 'ETHEREUM_BRIDGE_EVENT') return;

  const bridgeEvent = event.data as EthereumBridgeEvent;
  const { event: eventType, data } = bridgeEvent;

  const listeners = eventListeners.get(eventType);
  if (listeners) {
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[Ethereum Bridge] Error in event listener for ${eventType}:`, error);
      }
    });
  }
}

/**
 * 发送请求到桥接脚本
 */
async function sendRequest(action: string, data?: any): Promise<any> {
  // 确保桥接已初始化
  if (!isBridgeInjected) {
    const initialized = await initEthereumBridge();
    if (!initialized) {
      throw new Error('Failed to initialize ethereum bridge');
    }
  }

  const id = generateId();

  return new Promise((resolve, reject) => {
    // 设置超时
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 30000); // 30 秒超时

    // 存储待处理的请求
    pendingRequests.set(id, {
      resolve: value => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: error => {
        clearTimeout(timeout);
        reject(error);
      },
    });

    // 发送消息到桥接脚本
    const request: EthereumBridgeRequest = {
      type: 'ETHEREUM_BRIDGE_REQUEST',
      action,
      id,
      data,
    };

    window.postMessage(request, '*');
  });
}

/**
 * 检查钱包是否存在
 */
export async function checkWallet(): Promise<{
  exists: boolean;
  isMetaMask: boolean;
  chainId: string;
  selectedAddress: string | null;
  isConnected: boolean;
}> {
  return sendRequest('check');
}

/**
 * 请求连接账户
 */
export async function requestAccounts(): Promise<string[]> {
  return sendRequest('requestAccounts');
}

/**
 * 获取已连接的账户
 */
export async function getAccounts(): Promise<string[]> {
  return sendRequest('getAccounts');
}

/**
 * 获取当前链 ID
 */
export async function getChainId(): Promise<string> {
  return sendRequest('getChainId');
}

/**
 * 签名消息
 */
export async function signMessage(message: string, address: string): Promise<string> {
  return sendRequest('signMessage', { message, address });
}

/**
 * 签名交易
 */
export async function signTransaction(transaction: any): Promise<string> {
  return sendRequest('signTransaction', { transaction });
}

/**
 * 发送交易
 */
export async function sendTransaction(transaction: any): Promise<string> {
  return sendRequest('sendTransaction', { transaction });
}

/**
 * 切换网络
 */
export async function switchChain(chainId: string): Promise<void> {
  return sendRequest('switchChain', { chainId });
}

/**
 * 添加网络
 */
export async function addChain(chainConfig: any): Promise<void> {
  return sendRequest('addChain', { chainConfig });
}

/**
 * 添加代币到钱包
 */
export async function watchAsset(asset: {
  address: string;
  symbol: string;
  decimals: number;
  image?: string;
}): Promise<boolean> {
  return sendRequest('watchAsset', { asset });
}

/**
 * 监听账户变化
 */
export function onAccountsChanged(callback: (accounts: string[]) => void) {
  if (!eventListeners.has('accountsChanged')) {
    eventListeners.set('accountsChanged', new Set());
  }
  eventListeners.get('accountsChanged')!.add(callback);
}

/**
 * 监听链变化
 */
export function onChainChanged(callback: (chainId: string) => void) {
  if (!eventListeners.has('chainChanged')) {
    eventListeners.set('chainChanged', new Set());
  }
  eventListeners.get('chainChanged')!.add(callback);
}

/**
 * 监听连接状态
 */
export function onConnect(callback: (connectInfo: { chainId: string }) => void) {
  if (!eventListeners.has('connect')) {
    eventListeners.set('connect', new Set());
  }
  eventListeners.get('connect')!.add(callback);
}

/**
 * 监听断开连接
 */
export function onDisconnect(callback: (error?: { message: string }) => void) {
  if (!eventListeners.has('disconnect')) {
    eventListeners.set('disconnect', new Set());
  }
  eventListeners.get('disconnect')!.add(callback);
}

/**
 * 移除事件监听
 */
export function removeEventListener(event: string, callback: EthereumBridgeEventHandler) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.delete(callback);
  }
}

/**
 * 清理桥接
 */
export function cleanup() {
  // 移除所有事件监听器
  window.removeEventListener('message', handleBridgeMessage);
  window.removeEventListener('message', handleBridgeEvent);

  // 清空待处理的请求
  pendingRequests.forEach(pending => {
    pending.reject(new Error('Bridge cleaned up'));
  });
  pendingRequests.clear();

  // 清空事件监听器
  eventListeners.clear();

  isBridgeInjected = false;
}
