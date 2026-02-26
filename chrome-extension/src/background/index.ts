import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// ========================================
// 点击扩展图标打开 content-ui 侧边窗口
// ========================================

chrome.action.onClicked.addListener(async tab => {
  console.log('[Background] Extension icon clicked, opening content-ui side panel');

  if (!tab.id) {
    console.error('[Background] No tab ID');
    return;
  }

  // 检查页面是否支持
  if (tab.url) {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-128.png'),
        title: 'Cannot open side panel',
        message: 'Content UI cannot be opened on this page. Please navigate to a regular webpage.',
      });
      return;
    }
  }

  try {
    // 发送消息到 content-ui 打开侧边窗口
    const messageSent = await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEPANEL' });
    console.log('[Background] OPEN_SIDEPANEL message sent successfully');
  } catch (error) {
    // content script 未加载，先注入再发送消息
    console.log('[Background] Content script not loaded, injecting content-ui...');

    try {
      // 注入 content-ui
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-ui/all.iife.js'],
      });

      // 等待一下确保 content script 已加载
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEPANEL' });
          console.log('[Background] OPEN_SIDEPANEL message sent after injection');
        } catch (err) {
          console.error('[Background] Failed to send message after injection:', err);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icon-128.png'),
            title: 'Failed to open side panel',
            message: 'Could not open content UI. Please refresh the page and try again.',
          });
        }
      }, 300);
    } catch (injectError) {
      console.error('[Background] Failed to inject content script:', injectError);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-128.png'),
        title: 'Failed to inject content script',
        message: 'Cannot inject content UI on this page.',
      });
    }
  }
});

const TURNSTILE_OFFSCREEN_URL = chrome.runtime.getURL('turnstile-offscreen.html');
let turnstileOffscreenReady: Promise<void> | null = null;

const ensureTurnstileOffscreen = async () => {
  if (!chrome.offscreen) return;
  if (await chrome.offscreen.hasDocument()) return;
  if (!turnstileOffscreenReady) {
    turnstileOffscreenReady = chrome.offscreen.createDocument({
      url: TURNSTILE_OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Render Turnstile in an extension context to avoid page CSP',
    });
  }
  await turnstileOffscreenReady;
};

// ========================================
// Web3 Wallet Support - via Background Script
// ========================================

/**
 * 处理来自 Content Script �?Web3 请求
 * 使用 chrome.scripting.executeScript 在页面主上下文执行代�?
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request);

  if (request.type === 'PROXY_FETCH') {
    const { url, method = 'GET', headers = {}, body } = request;
    fetch(url, {
      method,
      headers,
      body,
    })
      .then(async response => {
        const text = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        sendResponse({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          data: text,
        });
      })
      .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }
  if (request.type === 'TURNSTILE_TOKEN_REQUEST') {
    ensureTurnstileOffscreen()
      .then(() => chrome.runtime.sendMessage(request))
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'TURNSTILE_TOKEN_RESPONSE',
          requestId: request.requestId,
          error: error?.message || String(error),
        });
      });
    return true;
  }
  if (request.type === 'WEB3_REQUEST') {
    handleWeb3Request(request, sender)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // 异步响应
  }

  if (request.type === 'ENSURE_WALLET_LISTENERS') {
    // 确保 wallet 事件监听器已注入
    const tabId = sender.tab?.id;
    if (tabId) {
      injectWalletEventListeners(tabId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab ID' });
    }
    return true;
  }

  if (request.type === 'GET_PROVIDER_ID') {
    // 获取当前 provider 的唯一标识
    getProviderId(sender)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  return false;
});

/**
 * 处理 Web3 请求
 * 在页面主上下文中执行 ethereum 方法
 */
async function handleWeb3Request(request: any, sender: chrome.runtime.MessageSender) {
  const { method, args = [] } = request;

  console.log('[Background] Executing:', method, args);

  const tabId = sender.tab?.id;

  if (!tabId) {
    throw new Error('No tab ID found. Are you calling from a Content Script?');
  }

  try {
    // 使用 chrome.scripting.executeScript 在页面主上下文执�?
    // 关键：指�?world: 'MAIN' 以在页面主世界执行（而不是隔离世界）
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN', // 🔑 关键：在页面主世界执行！
      func: async (_method: string, _methodArgs: any[]) => {
        // 这段代码现在运行在页面主上下文！
        const formatError = (error: any) => {
          if (!error) return 'Unknown error';
          if (typeof error === 'string') return error;

          const message = error?.message || error?.toString?.() || 'Unknown error';
          const details: Record<string, any> = {};
          if (error?.name) details.name = error.name;
          if (error?.code !== undefined) details.code = error.code;
          if (error?.data !== undefined) details.data = error.data;
          if (error?.stack) details.stack = error.stack;

          try {
            const detailString = Object.keys(details).length > 0 ? ` | ${JSON.stringify(details)}` : '';
            return `${message}${detailString}`;
          } catch {
            return message;
          }
        };

        const requestWithTimeout = async <T>(promise: Promise<T>, ms = 12000): Promise<T> => {
          let timeoutId: any;
          const timeout = new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Request timeout')), ms);
          });
          try {
            return await Promise.race([promise, timeout]);
          } finally {
            clearTimeout(timeoutId);
          }
        };

        const normalizeProviderType = (input?: string) => {
          if (!input) return 'unknown';
          const value = input.toLowerCase();
          if (value.includes('metamask')) return 'metamask';
          if (value.includes('rabby')) return 'rabby';
          if (value.includes('phantom')) return 'phantom';
          if (value.includes('trust')) return 'trust';
          if (value.includes('coinbase')) return 'coinbase';
          if (value.includes('binance')) return 'binance';
          if (value.includes('okx')) return 'okx';
          if (value.includes('bitget')) return 'bitget';
          if (value.includes('brave')) return 'brave';
          if (value.includes('kucoin')) return 'kucoin';
          return 'unknown';
        };

        const collectEip6963Providers = async () => {
          const providers: { id: string; type: string; name: string; icon?: string }[] = [];
          const seen = new Set<string>();
          const registry = (window as any).__eip6963ProviderRegistry || {};

          const onAnnounce = (event: Event) => {
            const customEvent = event as CustomEvent;
            const detail = customEvent.detail as
              | { info?: { name?: string; rdns?: string; uuid?: string; icon?: string }; provider?: unknown }
              | undefined;
            if (!detail?.info) return;

            const info = detail.info;
            const type = normalizeProviderType(info.rdns || info.name || info.uuid);
            const idSeed = info.rdns || info.uuid || info.name || type;
            if (!idSeed) return;
            if (seen.has(idSeed)) return;
            seen.add(idSeed);

            const eipId = `eip6963:${idSeed}`;
            if (detail.provider) {
              registry[eipId] = detail.provider;
            }

            providers.push({
              id: eipId,
              type,
              name: info.name || info.rdns || 'Injected Wallet',
              icon: info.icon,
            });
          };

          window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
          try {
            window.dispatchEvent(new Event('eip6963:requestProvider'));
            await new Promise(resolve => setTimeout(resolve, 300));
          } finally {
            window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
          }

          (window as any).__eip6963ProviderRegistry = registry;
          return providers;
        };

        const getProviders = async () => {
          const eip6963Providers = await collectEip6963Providers();
          const providers = Array.isArray(window.ethereum?.providers)
            ? window.ethereum.providers
            : typeof window.ethereum !== 'undefined'
              ? [window.ethereum]
              : [];

          const detectProviderType = (provider: any) => {
            if (provider?.isMetaMask) return 'metamask';
            if (provider?.isRabby) return 'rabby';
            if (provider?.isPhantom) return 'phantom';
            if (provider?.isTrust) return 'trust';
            if (provider?.isCoinbaseWallet) return 'coinbase';
            if (provider?.isBinance) return 'binance';
            if (provider?.isOkxWallet) return 'okx';
            if (provider?.isBitget) return 'bitget';
            if (provider?.isBraveWallet) return 'brave';
            if (provider?.isKuCoin) return 'kucoin';
            return 'unknown';
          };

          const logProviderFlags = (provider: any) => {
            const flags = {
              isMetaMask: !!provider?.isMetaMask,
              isRabby: !!provider?.isRabby,
              isPhantom: !!provider?.isPhantom,
              isTrust: !!provider?.isTrust,
              isCoinbaseWallet: !!provider?.isCoinbaseWallet,
              isBinance: !!provider?.isBinance,
              isOkxWallet: !!provider?.isOkxWallet,
              isBitget: !!provider?.isBitget,
              isBraveWallet: !!provider?.isBraveWallet,
              isKuCoin: !!provider?.isKuCoin,
            };
            try {
              console.log('[Wallet Detect] Provider flags:', flags);
            } catch {
              // no-op
            }
          };

          const resolveProviderName = (provider: any) => {
            if (provider?.isMetaMask) return 'MetaMask';
            if (provider?.isRabby) return 'Rabby';
            if (provider?.isPhantom) return 'Phantom';
            if (provider?.isTrust) return 'Trust Wallet';
            if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
            if (provider?.isBinance) return 'Binance Wallet';
            if (provider?.isOkxWallet) return 'OKX Wallet';
            if (provider?.isBitget) return 'Bitget Wallet';
            if (provider?.isBraveWallet) return 'Brave Wallet';
            if (provider?.isKuCoin) return 'KuCoin Wallet';
            return provider?.name || 'Injected Wallet';
          };

          const result = providers.map((provider: any, index: number) => {
            logProviderFlags(provider);
            const type = detectProviderType(provider);
            return {
              id: `${type}-${index}`,
              type,
              name: resolveProviderName(provider),
            };
          });

          const merged = [...eip6963Providers];
          const mergedKeys = new Set(merged.map(item => `${item.type}:${item.name}`));
          result.forEach(item => {
            const key = `${item.type}:${item.name}`;
            if (!mergedKeys.has(key)) {
              merged.push({ ...item, id: `${item.type}-${merged.length}` });
              mergedKeys.add(key);
            }
          });

          if (merged.length > 0 && !merged.some(item => item.type === 'unknown')) {
            return merged;
          }

          const single = typeof window.ethereum !== 'undefined' ? window.ethereum : null;
          if (single) {
            logProviderFlags(single);
          }
          if (!single) return merged.length > 0 ? merged : result;

          const fallbackTypes = [
            { key: 'isMetaMask', type: 'metamask', name: 'MetaMask' },
            { key: 'isRabby', type: 'rabby', name: 'Rabby' },
            { key: 'isPhantom', type: 'phantom', name: 'Phantom' },
            { key: 'isTrust', type: 'trust', name: 'Trust Wallet' },
            { key: 'isCoinbaseWallet', type: 'coinbase', name: 'Coinbase Wallet' },
            { key: 'isBinance', type: 'binance', name: 'Binance Wallet' },
            { key: 'isOkxWallet', type: 'okx', name: 'OKX Wallet' },
            { key: 'isBitget', type: 'bitget', name: 'Bitget Wallet' },
            { key: 'isBraveWallet', type: 'brave', name: 'Brave Wallet' },
            { key: 'isKuCoin', type: 'kucoin', name: 'KuCoin Wallet' },
          ];

          const detected = fallbackTypes
            .filter(item => !!(single as any)[item.key])
            .map((item, index) => ({
              id: `${item.type}-${index}`,
              type: item.type,
              name: item.name,
            }));

          if (detected.length > 0) {
            const mergedFallback = [...eip6963Providers];
            const mergedFallbackKeys = new Set(mergedFallback.map(item => `${item.type}:${item.name}`));
            detected.forEach(item => {
              const key = `${item.type}:${item.name}`;
              if (!mergedFallbackKeys.has(key)) {
                mergedFallback.push({ ...item, id: `${item.type}-${mergedFallback.length}` });
                mergedFallbackKeys.add(key);
              }
            });
            return mergedFallback;
          }

          return merged.length > 0 ? merged : result;
        };

        const resolveProviderById = (providerId: string | undefined) => {
          const providers = Array.isArray(window.ethereum?.providers)
            ? window.ethereum.providers
            : typeof window.ethereum !== 'undefined'
              ? [window.ethereum]
              : [];

          if (providerId?.startsWith('eip6963:')) {
            const registry = (window as any).__eip6963ProviderRegistry || {};
            const provider = registry[providerId];
            if (provider) return provider;
          }

          if (!providerId) return providers[0];

          const [type, indexString] = providerId.split('-');
          const index = Number.parseInt(indexString || '0', 10);

          const matchesType = (provider: any) => {
            if (type === 'metamask') return !!provider?.isMetaMask;
            if (type === 'rabby') return !!provider?.isRabby;
            if (type === 'phantom') return !!provider?.isPhantom;
            if (type === 'trust') return !!provider?.isTrust;
            if (type === 'coinbase') return !!provider?.isCoinbaseWallet;
            if (type === 'binance') return !!provider?.isBinance;
            if (type === 'okx') return !!provider?.isOkxWallet;
            if (type === 'bitget') return !!provider?.isBitget;
            if (type === 'brave') return !!provider?.isBraveWallet;
            if (type === 'kucoin') return !!provider?.isKuCoin;
            return false;
          };

          const matched = providers.filter(matchesType);
          if (matched.length > 0) {
            return matched[index] || matched[0];
          }

          return providers[0];
        };

        if (typeof window.ethereum === 'undefined') {
          return { success: false, error: 'No ethereum provider found' };
        }

        try {
          // 特殊处理 isMetaMask
          if (_method === 'isMetaMask') {
            const result = !!window.ethereum.isMetaMask;
            return { success: true, result: result };
          }

          if (_method === 'getWalletFlags') {
            const providers = Array.isArray(window.ethereum?.providers)
              ? window.ethereum.providers
              : typeof window.ethereum !== 'undefined'
                ? [window.ethereum]
                : [];

            const collectFlags = (provider: any) => ({
              isMetaMask: !!provider?.isMetaMask,
              isRabby: !!provider?.isRabby,
              isPhantom: !!provider?.isPhantom,
              isTrust: !!provider?.isTrust,
              isCoinbaseWallet: !!provider?.isCoinbaseWallet,
              isBinance: !!provider?.isBinance,
              isOkxWallet: !!provider?.isOkxWallet,
              isBitget: !!provider?.isBitget,
              isBraveWallet: !!provider?.isBraveWallet,
              isKuCoin: !!provider?.isKuCoin,
            });

            const flags = providers.map(collectFlags);
            const single = typeof window.ethereum !== 'undefined' ? collectFlags(window.ethereum) : null;
            return { success: true, result: { providersCount: providers.length, flags, single } };
          }

          if (_method === 'getWalletProviders') {
            return { success: true, result: await getProviders() };
          }

          if (_method === 'wallet_requestAccounts') {
            const providerId = _methodArgs?.[0] as string | undefined;
            const provider = resolveProviderById(providerId);
            if (!provider) {
              return { success: false, error: 'No ethereum provider found' };
            }
            try {
              if (typeof provider.request === 'function') {
                const result = await requestWithTimeout(provider.request({ method: 'eth_requestAccounts' }));
                return { success: true, result };
              }
              if (typeof provider.send === 'function') {
                const result = await requestWithTimeout(provider.send('eth_requestAccounts', []));
                return { success: true, result };
              }
              if (typeof (provider as any).enable === 'function') {
                const result = await requestWithTimeout((provider as any).enable());
                return { success: true, result };
              }
              if (typeof (provider as any).connect === 'function') {
                const result = await requestWithTimeout((provider as any).connect());
                return { success: true, result };
              }
              return { success: false, error: 'Provider does not support request/send/enable/connect' };
            } catch (error) {
              return { success: false, error: formatError(error) };
            }
          }

          if (_method === 'wallet_getAccounts') {
            const providerId = _methodArgs?.[0] as string | undefined;
            const provider = resolveProviderById(providerId);
            if (!provider) {
              return { success: false, error: 'No ethereum provider found' };
            }
            try {
              if (typeof provider.request === 'function') {
                const result = await provider.request({ method: 'eth_accounts' });
                return { success: true, result };
              }
              if (typeof provider.send === 'function') {
                const result = await provider.send('eth_accounts', []);
                return { success: true, result };
              }
              return { success: false, error: 'Provider does not support request/send' };
            } catch (error) {
              return { success: false, error: formatError(error) };
            }
          }

          if (_method === 'wallet_getChainId') {
            const providerId = _methodArgs?.[0] as string | undefined;
            const provider = resolveProviderById(providerId);
            if (!provider) {
              return { success: false, error: 'No ethereum provider found' };
            }
            try {
              if (typeof provider.request === 'function') {
                const result = await provider.request({ method: 'eth_chainId' });
                return { success: true, result };
              }
              if (typeof provider.send === 'function') {
                const result = await provider.send('eth_chainId', []);
                return { success: true, result };
              }
              return { success: false, error: 'Provider does not support request/send' };
            } catch (error) {
              return { success: false, error: formatError(error) };
            }
          }

          if (_method === 'wallet_signMessage') {
            const providerId = _methodArgs?.[0] as string | undefined;
            const messageToSign = _methodArgs?.[1] as string | undefined;
            const address = _methodArgs?.[2] as string | undefined;
            const provider = resolveProviderById(providerId);
            if (!provider) {
              return { success: false, error: 'No ethereum provider found' };
            }
            if (!messageToSign) {
              return { success: false, error: 'Missing message to sign' };
            }
            const params = address ? [messageToSign, address] : [messageToSign];
            try {
              if (typeof provider.request === 'function') {
                const result = await provider.request({ method: 'personal_sign', params });
                return { success: true, result };
              }
              if (typeof provider.send === 'function') {
                const result = await provider.send('personal_sign', params);
                return { success: true, result };
              }
              return { success: false, error: 'Provider does not support request/send' };
            } catch (error) {
              return { success: false, error: formatError(error) };
            }
          }

          // 所有其他方法都通过 request() 调用
          // MetaMask API: window.ethereum.request({ method, params })

          const result = await window.ethereum.request({
            method: _method,
            params: _methodArgs,
          });

          return { success: true, result: result };
        } catch (error) {
          return { success: false, error: formatError(error) };
        }
      },
      args: [method, args],
    });

    console.log('[Background] ExecuteScript results:', JSON.stringify(results, null, 2));

    if (results && results[0] && results[0].result) {
      const injectedResult = results[0].result;
      console.log('[Background] Injected result:', injectedResult);

      if (injectedResult.success === false && injectedResult.error) {
        console.log('[Background] Returning error:', injectedResult.error);
        return { success: false, error: injectedResult.error };
      }

      if (injectedResult.success === true) {
        console.log('[Background] Returning success:', injectedResult.result);
        return { success: true, result: injectedResult.result };
      }

      // 如果没有 success 字段，可能是直接返回的�?
      console.log('[Background] Returning direct result:', injectedResult);
      return { success: true, result: injectedResult };
    }

    console.error('[Background] Invalid result structure');
    throw new Error('Execution failed - invalid result');
  } catch (error) {
    console.error('[Background] Exception:', error);

    // 检查是否是因为没有权限
    if (error instanceof Error && error.message.includes('Cannot access')) {
      return {
        success: false,
        error: 'Cannot access page. Please refresh the page and try again.',
      };
    }

    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 获取 provider 的唯一标识
 * 用于检�?MetaMask 是否重启
 */
async function getProviderId(
  sender: chrome.runtime.MessageSender,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const tabId = sender.tab?.id;

  if (!tabId) {
    throw new Error('No tab ID found');
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        if (typeof window.ethereum === 'undefined') {
          return { success: false, error: 'No ethereum provider' };
        }

        // 生成一个唯一标识：使�?provider 的多个属性组�?
        const provider = window.ethereum;
        const identifier = {
          isMetaMask: provider.isMetaMask,
          // 使用 chainId �?selectedAddress 作为额外标识
          chainId: provider.chainId || null,
          selectedAddress: provider.selectedAddress || null,
          // 生成一个时间戳标识（provider 对象创建时的隐式标识�?
          // 注意：不同实例的这些属性组合可能不�?
        };

        // 将标识转换为字符�?
        const idString = JSON.stringify(identifier);
        return { success: true, result: idString };
      },
    });

    if (results && results[0] && results[0].result) {
      const injectedResult = results[0].result;
      if (injectedResult.success) {
        return { success: true, result: injectedResult.result };
      }
      throw new Error(injectedResult.error || 'Failed to get provider ID');
    }

    throw new Error('Invalid result');
  } catch (error) {
    console.error('[Background] Failed to get provider ID:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ========================================
// MetaMask Event Listeners Injection
// ========================================

/**
 * 向页面注�?MetaMask 事件监听�?
 * 监听 accountsChanged, chainChanged, connect, disconnect 事件
 */
async function injectWalletEventListeners(tabId: number, retryCount = 0) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        if (typeof window.ethereum === 'undefined') {
          console.log('[Wallet Events] No ethereum provider found');
          return { success: false, error: 'No ethereum provider' };
        }

        console.log('[Wallet Events] Injecting event listeners...');

        const currentProvider = window.ethereum;
        const installedProvider = (window as any)._walletEventListenersProvider;
        if ((window as any)._walletEventListenersInstalled && installedProvider === currentProvider) {
          console.log('[Wallet Events] Already installed, skipping');
          return { success: true, message: 'Already installed' };
        }

        // 监听账户变化
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
          console.log('[Wallet Events] accountsChanged:', accounts);
          chrome.runtime.sendMessage({
            type: 'WALLET_EVENT',
            event: 'accountsChanged',
            data: { accounts },
          });
        });

        // 监听链ID变化
        window.ethereum.on('chainChanged', (chainId: string) => {
          console.log('[Wallet Events] chainChanged:', chainId);
          chrome.runtime.sendMessage({
            type: 'WALLET_EVENT',
            event: 'chainChanged',
            data: { chainId },
          });
        });

        // 监听连接事件
        window.ethereum.on('connect', (connectInfo: { chainId: string }) => {
          console.log('[Wallet Events] connect:', connectInfo);
          chrome.runtime.sendMessage({
            type: 'WALLET_EVENT',
            event: 'connect',
            data: connectInfo,
          });
        });

        // 监听断开连接事件
        window.ethereum.on('disconnect', (error: { code: number; message: string }) => {
          console.log('[Wallet Events] disconnect:', error);
          chrome.runtime.sendMessage({
            type: 'WALLET_EVENT',
            event: 'disconnect',
            data: error,
          });
        });

        (window as any)._walletEventListenersInstalled = true;
        (window as any)._walletEventListenersProvider = currentProvider;
        console.log('[Wallet Events] Event listeners installed successfully');
        return { success: true, message: 'Installed' };
      },
    });
    console.log('[Background] Wallet event listeners injected for tab:', tabId);
  } catch (error) {
    console.error('[Background] Failed to inject event listeners:', error);

    // 如果注入失败，可能是页面还没加载完成，延迟重�?
    if (retryCount < 3) {
      console.log(`[Background] Retrying injection (${retryCount + 1}/3)...`);
      setTimeout(
        () => {
          injectWalletEventListeners(tabId, retryCount + 1);
        },
        1000 * (retryCount + 1),
      ); // 1s, 2s, 3s 延迟
    }
  }
}

// 监听标签页更新，注入事件监听�?
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 只在 http/https 页面注入
    if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
      injectWalletEventListeners(tabId);
    }
  }
});

// 转发钱包事件到所�?Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'WALLET_EVENT') {
    console.log('[Background] Forwarding wallet event:', request.event, request.data);

    // 转发�?sender tab 的所�?content scripts
    if (sender.tab?.id) {
      chrome.tabs
        .sendMessage(sender.tab.id, {
          type: 'WALLET_EVENT_FORWARD',
          event: request.event,
          data: request.data,
        })
        .catch(() => {
          // 忽略没有 content script �?tab
        });
    }
    return true;
  }

  return false;
});

// 监听扩展安装/更新
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed/updated');

  // 向所有已打开的标签页注入事件监听�?
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        injectWalletEventListeners(tab.id);
      }
    });
  });
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'PROXY_STREAM') return;

  let abortController: AbortController | null = null;

  port.onMessage.addListener(message => {
    if (message.type === 'abort') {
      abortController?.abort();
      return;
    }

    if (message.type !== 'start') return;

    const { url, method = 'GET', headers = {}, body } = message;
    abortController = new AbortController();

    fetch(url, {
      method,
      headers,
      body,
      signal: abortController.signal,
    })
      .then(async response => {
        if (!response.body) {
          port.postMessage({ type: 'error', message: 'No response body' });
          port.disconnect();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          port.postMessage({ type: 'chunk', value: chunk });
        }

        port.postMessage({ type: 'done' });
        port.disconnect();
      })
      .catch(error => {
        if (abortController?.signal.aborted) {
          port.postMessage({ type: 'aborted' });
        } else {
          port.postMessage({ type: 'error', message: error.message || String(error) });
        }
        port.disconnect();
      });
  });
});
