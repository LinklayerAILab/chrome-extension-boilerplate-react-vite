/**
 * 检测页面主上下文中的注入钱包（如 MetaMask）
 * 由于 CSP 限制，不能使用脚本注入，改用其他方法
 */

let isBridgeInjected = false;

/**
 * 注入钱包桥接脚本到页面主上下文
 * 使用 file:// 协议或者 data URI 来绕过 CSP
 */
export const injectWalletBridge = () => {
  if (isBridgeInjected) {
    return;
  }

  try {
    // 创建一个 script 标签，使用 data URI 来绕过 CSP 的 inline-script 限制
    const script = document.createElement('script');
    script.id = 'wallet-bridge-script';

    // 使用立即执行函数，封装到 data URI
    const bridgeCode = `
      (function() {
        if (window.__WALLET_BRIDGE_INITIALIZED__) return;
        window.__WALLET_BRIDGE_INITIALIZED__ = true;

        console.log('[Wallet Bridge] Initialized in page context');

        // 监听来自 Content Script 的请求
        window.addEventListener('WALLET_BRIDGE_REQUEST', function(event) {
          const detail = event.detail;
          const { method, args, id } = detail;

          console.log('[Wallet Bridge] Received request:', method, args);

          // 检查 ethereum 是否存在
          if (typeof window.ethereum === 'undefined') {
            window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
              detail: { success: false, error: 'No ethereum provider found' }
            }));
            return;
          }

          // 执行方法
          try {
            if (typeof window.ethereum[method] === 'function') {
              const result = window.ethereum[method](...(args || []));

              // 处理 Promise
              if (result && typeof result.then === 'function') {
                result
                  .then(res => {
                    window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
                      detail: { success: true, result: res }
                    }));
                  })
                  .catch(err => {
                    window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
                      detail: { success: false, error: err.message || err.toString() }
                    }));
                  });
              } else {
                // 同步返回
                window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
                  detail: { success: true, result: result }
                }));
              }
            } else if (method === 'isMetaMask' || method === 'isCoinbaseWallet') {
              // 属性访问
              window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
                detail: { success: true, result: !!window.ethereum[method] }
              }));
            } else {
              window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
                detail: { success: false, error: 'Method not found: ' + method }
              }));
            }
          } catch (err) {
            window.dispatchEvent(new CustomEvent('WALLET_BRIDGE_RESPONSE_' + id, {
              detail: { success: false, error: err.message || err.toString() }
            }));
          }
        });
      })();
    `;

    // 使用 data URI 绕过 CSP
    script.src = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(bridgeCode)));
    script.onload = () => {
      script.remove();
      isBridgeInjected = true;
      console.log('[Wallet] Bridge script injected successfully');
    };
    script.onerror = () => {
      console.error('[Wallet] Failed to inject bridge script');
      script.remove();
    };

    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.error('[Wallet] Error injecting wallet bridge:', err);
  }
};

/**
 * 通过桥接脚本在页面主上下文执行方法
 */
const executeViaBridge = (method: string, args?: any[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();

    const responseHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!customEvent.detail) return;

      const { success, result, error } = customEvent.detail;
      window.removeEventListener('WALLET_BRIDGE_RESPONSE_' + id, responseHandler as EventListener);

      if (success) {
        resolve(result);
      } else {
        reject(new Error(error || 'Execution failed'));
      }
    };

    window.addEventListener('WALLET_BRIDGE_RESPONSE_' + id, responseHandler as EventListener);

    // 发送请求到页面主上下文
    window.dispatchEvent(
      new CustomEvent('WALLET_BRIDGE_REQUEST', {
        detail: { method, args, id },
      }),
    );

    // 设置超时
    setTimeout(() => {
      window.removeEventListener('WALLET_BRIDGE_RESPONSE_' + id, responseHandler as EventListener);
      reject(new Error('Request timeout'));
    }, 10000);
  });
};

/**
 * 检测页面主上下文是否有 ethereum
 */
export const detectWalletInPageContext = async (): Promise<boolean> => {
  try {
    // 先尝试直接访问（某些情况下 Content Script 的 window 会继承页面主上下文的 ethereum）
    if (typeof (window as any).ethereum !== 'undefined') {
      console.log('[Wallet] Found ethereum in content script window');
      return true;
    }

    // 注入桥接脚本
    injectWalletBridge();

    // 等待一下确保脚本已执行
    await new Promise(resolve => setTimeout(resolve, 100));

    // 通过桥接检测
    const hasEthereum = await executeViaBridge('isMetaMask', []);
    console.log('[Wallet] Bridge detection result:', hasEthereum);
    return hasEthereum;
  } catch (err) {
    console.error('[Wallet] Detection failed:', err);
    return false;
  }
};

/**
 * 创建代理的 ethereum provider
 */
export const createEthereumProviderProxy = (): any => {
  const proxy = new Proxy({} as any, {
    get(_target, prop) {
      return async (...args: any[]) => {
        console.log('[Wallet Proxy]', prop, args);
        return executeViaBridge(String(prop), args);
      };
    },
    has(_target, prop) {
      // 让 in 操作符正常工作
      return true;
    },
  });

  return proxy;
};

/**
 * 桥接 ethereum provider
 */
export const bridgeEthereumProvider = async (): Promise<boolean> => {
  try {
    // 先检查是否已存在
    if ((window as any).ethereum && (window as any).__isPro__) {
      console.log('[Wallet] Ethereum already bridged');
      return true;
    }

    // 注入桥接
    injectWalletBridge();

    // 等待桥接就绪
    await new Promise(resolve => setTimeout(resolve, 150));

    // 检测钱包
    const hasWallet = await detectWalletInPageContext();

    if (hasWallet) {
      // 创建代理
      const proxy = createEthereumProviderProxy();
      (window as any).ethereum = proxy;
      (window as any).ethereum.__isPro__ = true;
      console.log('[Wallet] Ethereum provider bridged via proxy');
      return true;
    }

    console.warn('[Wallet] No wallet detected in page context');
    return false;
  } catch (err) {
    console.error('[Wallet] Bridge failed:', err);
    return false;
  }
};
