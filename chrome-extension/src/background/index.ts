import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import {
  disableGuardPushPolling,
  enableGuardPushPolling,
  pollGuardMessages,
  registerGuardPushListeners,
} from './guard-push';

// Guard 告警通知：alarm 轮询 + 通知点击（register 后 service worker 重启也会自动恢复）
registerGuardPushListeners();

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
  recordFirstOpen();

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
  if (request.type === 'OPEN_URL') {
    // 在新标签页打开页面。content script 中 await 之后的 window.open 会丢失
    // 用户激活手势、可能被弹窗拦截，background 的 chrome.tabs.create 不受限制。
    //
    // 允许两类 URL：
    //   - https://  外部页面（如 Stripe 托管收银台）
    //   - 本站扩展页 options/index.html  消息中心等自有页面
    // 只放行固定路径，不放行任意 chrome-extension:// URL —— 后者等于把扩展内
    // 任意页面交给内容脚本打开，扩大攻击面。
    const { url } = request;
    const isHttps = typeof url === 'string' && /^https:\/\//.test(url);
    const isOwnOptionsPage = typeof url === 'string' && url === chrome.runtime.getURL('options/index.html');
    if (isHttps || isOwnOptionsPage) {
      chrome.tabs
        .create({ url, active: true })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Invalid URL' });
    }
    return true; // 异步响应
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

  if (request.type === 'RECORD_FIRST_OPEN') {
    recordFirstOpen();
    sendResponse({ success: true });
    return true;
  }

  // Guard 推送：内容脚本开启 / 关闭告警轮询
  if (request.type === 'GUARD_PUSH_ENABLE') {
    const { accessToken, address, apiBaseUrl } = request;
    if (typeof accessToken === 'string' && typeof address === 'string' && typeof apiBaseUrl === 'string') {
      enableGuardPushPolling({ accessToken, address, apiBaseUrl })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Invalid payload' });
    }
    return true;
  }

  if (request.type === 'GUARD_PUSH_DISABLE') {
    disableGuardPushPolling()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'GUARD_PUSH_POLL_NOW') {
    pollGuardMessages()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

          const normalize = (input: any): string => {
            if (!input) return 'Unknown error';

            if (typeof input === 'string') {
              const parsed = parseJson(input);
              if (parsed) {
                return normalize(parsed);
              }
              return extractCoreMessage(input);
            }

            if (typeof input === 'object' && input.error) {
              return normalize(input.error);
            }

            const code = input?.code ?? input?.data?.code;
            const rawMessage = input?.message || input?.toString?.() || 'Unknown error';
            const message = extractCoreMessage(String(rawMessage));

            if (code === 4001 || code === '4001') {
              return message || 'User denied request.';
            }

            return message || 'Unknown error';
          };

          return normalize(error);
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
                // 钱包解锁/连接弹窗常超过默认 12s（用户需输入密码），单独放宽
                const result = await requestWithTimeout(provider.request({ method: 'eth_requestAccounts' }), 60000);
                return { success: true, result };
              }
              if (typeof provider.send === 'function') {
                const result = await requestWithTimeout(provider.send('eth_requestAccounts', []), 60000);
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
 * 获取当前 provider 的稳定身份标识。
 *
 * 曾经返回 `JSON.stringify({ isMetaMask, chainId, selectedAddress })`，但那三项里
 * 后两项是**易变状态**：钱包锁屏时 selectedAddress 为 null、切链时 chainId 变化。
 * 于是重启浏览器后同一钱包算出的字符串必然不同，前端把它误判成「钱包实例已重启」
 * 并断开连接、清除存档 —— 这正是重启电脑后误报「钱包已断开」的根因之一。
 *
 * 现在只返回**扩展身份**，格式与 getProviders()/resolveProviderById 一致：
 * - `eip6963:<rdns>` 优先（若页面暴露了 EIP-6963 注册表且能定位到当前 provider）
 * - 否则回退 `<type>-<index>`，如 `metamask-0`
 *
 * 这两个格式都能被 resolveProviderById 解析回同一个 provider，且不随锁屏/切链变化。
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
        const eth = (window as any).ethereum;
        if (typeof eth === 'undefined') {
          return { success: false, error: 'No ethereum provider' };
        }

        // 与 getProviders() 的 detectProviderType 保持完全一致，
        // 否则算出的 id 无法被 resolveProviderById 解析回同一个 provider
        const detectType = (provider: any): string => {
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

        const providers = Array.isArray(eth.providers) ? eth.providers : [eth];
        const type = detectType(eth);

        // 优先使用 EIP-6963 的 rdns：它由钱包扩展自己声明，跨重启稳定且唯一。
        //
        // 注意：注册表只在 getProviders() 里填充，而冷启动时那个调用可能还没跑，
        // 直接读会拿到空对象并回退成 `metamask-0`，与存档里的 `eip6963:io.metamask`
        // 不一致 —— 于是同一钱包被判成「已重启」并清档。因此这里必须自行收集，
        // 不能依赖其他调用方先跑过。
        try {
          const registryKey = collectEip6963KeySync(eth);
          if (registryKey) {
            return { success: true, result: registryKey };
          }
        } catch {
          // 注册表不可用时回退到 type-index
        }

        // 回退：同类型 provider 中的序号。序号基于 provider 列表顺序，
        // 扩展集合不变时跨重启稳定（远好过 chainId/selectedAddress 快照）。
        const sameType = providers.filter((provider: any) => detectType(provider) === type);
        const index = sameType.indexOf(eth);
        return { success: true, result: `${type}-${index >= 0 ? index : 0}` };

        /**
         * 同步解析当前 provider 对应的 EIP-6963 键。
         * 注册表已有则直接匹配；为空则同步派发 requestProvider 事件，
         * 钱包会在该事件的同步回调里 announce（EIP-6963 规范要求同步响应），
         * 因此监听器内即可拿到 rdns，无需 await。
         */
        function collectEip6963KeySync(target: any): string | null {
          const registry = ((window as any).__eip6963ProviderRegistry ||= {});

          const findMatch = (): string | null => {
            for (const key of Object.keys(registry)) {
              if (key.startsWith('eip6963:') && registry[key] === target) {
                return key;
              }
            }
            return null;
          };

          const existing = findMatch();
          if (existing) return existing;

          // 同步收集：钱包对 requestProvider 的响应是同步 dispatch 的
          const onAnnounce = (event: Event) => {
            const detail = (event as CustomEvent).detail as
              | { info?: { name?: string; rdns?: string; uuid?: string }; provider?: unknown }
              | undefined;
            if (!detail?.info || !detail.provider) return;
            const idSeed = detail.info.rdns || detail.info.uuid || detail.info.name;
            if (!idSeed) return;
            registry[`eip6963:${idSeed}`] = detail.provider;
          };

          window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
          try {
            // 给钱包一个重试机会（部分钱包异步 announce），随后同步收集
            window.dispatchEvent(new Event('eip6963:requestProvider'));
          } finally {
            window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
          }

          return findMatch();
        }
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
      func: (extensionId: string) => {
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
          chrome.runtime.sendMessage(extensionId, {
            type: 'WALLET_EVENT',
            event: 'accountsChanged',
            data: { accounts },
          });
        });

        // 监听链ID变化
        window.ethereum.on('chainChanged', (chainId: string) => {
          console.log('[Wallet Events] chainChanged:', chainId);
          chrome.runtime.sendMessage(extensionId, {
            type: 'WALLET_EVENT',
            event: 'chainChanged',
            data: { chainId },
          });
        });

        // 监听连接事件
        window.ethereum.on('connect', (connectInfo: { chainId: string }) => {
          console.log('[Wallet Events] connect:', connectInfo);
          chrome.runtime.sendMessage(extensionId, {
            type: 'WALLET_EVENT',
            event: 'connect',
            data: connectInfo,
          });
        });

        // 监听断开连接事件
        window.ethereum.on('disconnect', (error: { code: number; message: string }) => {
          console.log('[Wallet Events] disconnect:', error);
          chrome.runtime.sendMessage(extensionId, {
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
      args: [chrome.runtime.id],
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
const STORAGE_KEY_INSTALL_ID = '@Linklayerai/installId';
const STORAGE_KEY_INSTALLED_AT = '@Linklayerai/installedAt';
const STORAGE_KEY_FIRST_OPENED_AT = '@Linklayerai/firstOpenedAt';

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

async function recordFirstOpen(): Promise<void> {
  const existing = await chrome.storage.local.get(STORAGE_KEY_FIRST_OPENED_AT);
  if (!existing[STORAGE_KEY_FIRST_OPENED_AT]) {
    await chrome.storage.local.set({ [STORAGE_KEY_FIRST_OPENED_AT]: nowUnix() });
    console.log('[Background] Recorded firstOpenedAt');
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed/updated');

  // 生成并持久化 installId 和 installedAt（用于 Chestо 任务验证）
  const existing = await chrome.storage.local.get([STORAGE_KEY_INSTALL_ID, STORAGE_KEY_INSTALLED_AT]);
  if (!existing[STORAGE_KEY_INSTALL_ID]) {
    const installId = crypto.randomUUID();
    const now = nowUnix();
    await chrome.storage.local.set({
      [STORAGE_KEY_INSTALL_ID]: installId,
      [STORAGE_KEY_INSTALLED_AT]: now,
    });
    console.log('[Background] Generated installId:', installId);

    // 上报安装事件到服务器
    const manifest = chrome.runtime.getManifest();
    const apiBaseUrl = process.env.CEB_AGENT_C_API || 'https://cagent.linklayer.ai';
    fetch(`${apiBaseUrl}/v1/extension/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, extensionVersion: manifest.version }),
    })
      .then(res => res.json())
      .then(data => console.log('[Background] Install event reported:', data))
      .catch(err => console.error('[Background] Failed to report install event:', err));
  } else if (!existing[STORAGE_KEY_INSTALLED_AT]) {
    await chrome.storage.local.set({ [STORAGE_KEY_INSTALLED_AT]: nowUnix() });
  }

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

// ========================================
// Chestо 任务验证 - 外部消息处理
// ========================================

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  // 仅接受来自 chesto.ai 的消息
  if (!sender.url || !sender.url.startsWith('https://chesto.ai/')) {
    console.warn('[Background] Rejected external message from:', sender.url);
    return false;
  }

  if (request.type === 'CHESTO_EXTENSION_VERIFY') {
    handleChestoVerify(request, sendResponse);
    return true;
  }

  return false;
});

async function handleChestoVerify(
  request: { claimToken?: string; attemptId?: string; taskId?: string },
  sendResponse: (response: unknown) => void,
) {
  try {
    const { claimToken, attemptId, taskId } = request;
    if (!claimToken) {
      sendResponse({ success: false, error: 'Missing claimToken' });
      return;
    }

    const stored = await chrome.storage.local.get([
      STORAGE_KEY_INSTALL_ID,
      STORAGE_KEY_INSTALLED_AT,
      STORAGE_KEY_FIRST_OPENED_AT,
    ]);
    const installId: string | undefined = stored[STORAGE_KEY_INSTALL_ID];
    const installedAt: number | undefined = stored[STORAGE_KEY_INSTALLED_AT];
    const firstOpenedAt: number | undefined = stored[STORAGE_KEY_FIRST_OPENED_AT];

    if (!installId) {
      sendResponse({ success: false, error: 'No installId found' });
      return;
    }

    const manifest = chrome.runtime.getManifest();
    const extensionVersion = manifest.version;

    const apiBaseUrl = process.env.CEB_AGENT_C_API || 'https://cagent.linklayer.ai';
    const response = await fetch(`${apiBaseUrl}/v1/extension/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimToken,
        attemptId,
        taskId,
        installId,
        extensionVersion,
        installedAt,
        firstOpenedAt,
      }),
    });

    const data = await response.json();
    sendResponse({ success: response.ok, data });
  } catch (error) {
    console.error('[Background] Chesto verify error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
