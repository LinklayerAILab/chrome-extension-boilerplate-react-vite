import { AddApi } from './components/AddApi';
import { Alpha } from './components/Alpha';
import { Login } from './components/Login';
import { Minting } from './components/Minting';
import { Perps } from './components/Perps';
import { Politer } from './components/Politer';
import { Points } from './components/Points';
import * as WalletStorage from './lib/walletStorage';
import { Menus } from './Menus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import inlineCss from '../../../dist/all/index.css?inline';
import { SocialBtns } from './components/SocialBtns';
import { PageLayout } from './components/PageLayout';
import { AlphaBg } from './components/AlphaBg';
import { I18nProvider } from '@src/lib/i18n';

// 使用 chrome.runtime.getURL 获取扩展资源
const getLogo = (path: string) => chrome.runtime.getURL(`content-ui/${path}`);
import { Popover, message } from '@src/ui';
import { RootState, store } from '@src/store';
import { logout as logoutApi } from '@src/api/user';
import {
  initializeFromLocalStorage,
  logout as logoutAction,
  setOtherInfo,
  setUserInfo,
  syncPoints,
} from '@src/store/slices/userSlice';
import { setSelectedMenuId, setSidePanelOpen } from '@src/store/slices/uiSlice';
import { LoginPanel } from './components/LoginPanel';
import { SiweMessage } from 'siwe';
import { getAddress } from 'viem';
import { getSiweNonce, verifySiweMessage } from '@src/api/user';
import { get_user_info } from '@src/api/agent_c';
import { API_BASE_URL } from '@src/api/config';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, INVITE_CODE_KEY } from '@src/lib/storageKeys';
import { useSelector } from 'react-redux';
import { selectPageInfo } from '@src/store/slices/pageInfoSlice';
import { user_rewardpoints } from '@src/api/user';
import { usePageInfoSync } from '@src/lib/hooks/usePageInfoSync';

// ⚠️ 白名单配置 - 只有这些域名才会注入 Content Script UI
// 格式：精确匹配域名或通配符 *.example.com
// 多个域名用逗号分隔
// 留空则允许所有域名（仅用于开发）
const CONTENT_UI_WHITELIST_DOMAINS = '';
declare global {
  interface Window {
    __CONTENT_UI_WHITELIST_DOMAINS__?: string;
  }
}
window.__CONTENT_UI_WHITELIST_DOMAINS__ = CONTENT_UI_WHITELIST_DOMAINS;

const pageKeyMap: Record<number, 'alpha' | 'api' | 'earn' | 'perps' | 'poliet' | 'points'> = {
  1: 'alpha',
  2: 'api',
  3: 'earn',
  4: 'perps',
  5: 'poliet',
  6: 'points',
};

/**
 * 检查当前域名是否在白名单内
 * @returns true 如果在白名单内，false 否则
 */
const isDomainWhitelisted = (): boolean => {
  const hostname = window.location.hostname;

  // 解析白名单
  const whitelist = CONTENT_UI_WHITELIST_DOMAINS ? CONTENT_UI_WHITELIST_DOMAINS.split(',').map(d => d.trim()) : [];

  // 如果白名单为空，允许所有域名（开发模式）
  if (whitelist.length === 0) {
    return true;
  }

  // 检查域名是否在白名单内
  const isAllowed = whitelist.some(whitelistDomain => {
    // 支持通配符 *.example.com
    if (whitelistDomain.startsWith('*.')) {
      const baseDomain = whitelistDomain.slice(2); // 移除 *.
      // 检查 hostname 是否以 baseDomain 结尾，或者是 baseDomain 本身
      return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
    }

    // 精确匹配
    return hostname === whitelistDomain;
  });

  if (!isAllowed) {
    console.log(`[Content UI] Domain "${hostname}" is not in whitelist:`, whitelist);
  } else {
    console.log(`[Content UI] Domain "${hostname}" is allowed by whitelist`);
  }

  return isAllowed;
};

// 通过 Background Script 在页面上下文执行代码
const executeViaBackgroundScript = async (method: string, args: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'WEB3_REQUEST',
        method,
        args,
      },
      response => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          console.error('[App] Chrome runtime error:', error);
          reject(new Error(error));
          return;
        }

        if (response?.error) {
          reject(new Error(response.error));
          return;
        }

        if (response?.success && response?.result !== undefined) {
          resolve(response.result);
          return;
        }

        reject(new Error('Invalid response from background script'));
      },
    );
  });
};

type InjectedWalletProvider = {
  id: string;
  type: string;
  name: string;
};

const getInjectedWalletProviders = async (): Promise<InjectedWalletProvider[]> => {
  try {
    const providers = await executeViaBackgroundScript('getWalletProviders', []);
    return Array.isArray(providers) ? providers : [];
  } catch (error) {
    console.error('[App] Failed to get wallet providers:', error);
    return [];
  }
};

// 获取当前 provider 的唯一标识（用于检测 MetaMask 重启）
const getProviderId = async (): Promise<string | null> => {
  try {
    const response = await new Promise<{ success: boolean; result?: string; error?: string }>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_PROVIDER_ID' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (response.success && response.result) {
      console.log('[App] Provider ID:', response.result);
      return response.result;
    }
    return null;
  } catch (error) {
    console.error('[App] Failed to get provider ID:', error);
    return null;
  }
};

// 检测页面上下文中的钱包
const checkPageContextWallet = async (providerId?: string): Promise<boolean> => {
  try {
    const providers = await getInjectedWalletProviders();
    if (providers.length === 0) {
      return false;
    }
    if (!providerId) {
      return true;
    }
    return providers.some(provider => provider.id === providerId);
  } catch (error) {
    console.error('[App] Failed to check wallet:', error);
    return false;
  }
};

// 连接页面上下文中的钱包
const connectPageContextWallet = async (providerId?: string): Promise<string> => {
  try {
    const accounts = providerId
      ? await executeViaBackgroundScript('wallet_requestAccounts', [providerId])
      : await executeViaBackgroundScript('eth_requestAccounts', []);

    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      const chainId = providerId
        ? await executeViaBackgroundScript('wallet_getChainId', [providerId])
        : await executeViaBackgroundScript('eth_chainId', []);
      const detectedProviderId = await getProviderId();

      console.log('[App] Wallet connected:', address);
      console.log('[App] Chain ID:', chainId);

      // ??????????? storage?????provider ID
      await WalletStorage.saveWalletState({
        isConnected: true,
        address,
        chainId,
        lastConnected: Date.now(),
        providerId: providerId || detectedProviderId || undefined, // ??? provider ID ??????????
      });

      return address;
    }
    throw new Error('No accounts returned');
  } catch (error) {
    console.error('[App] Failed to connect wallet:', error);
    throw error;
  }
};

// 获取当前连接的钱包账户
const getCurrentAccounts = async (providerId?: string): Promise<string[]> => {
  try {
    const accounts = providerId
      ? await executeViaBackgroundScript('wallet_getAccounts', [providerId])
      : await executeViaBackgroundScript('eth_accounts', []);
    return accounts || [];
  } catch (error) {
    console.error('[App] Failed to get current accounts:', error);
    return [];
  }
};

const getCurrentChainId = async (providerId?: string): Promise<string> => {
  return providerId
    ? await executeViaBackgroundScript('wallet_getChainId', [providerId])
    : await executeViaBackgroundScript('eth_chainId', []);
};

const isProviderInstanceId = (value?: string | null) => Boolean(value && value.startsWith('{'));

const signMessageWithProvider = async (messageToSign: string, address: string, providerId?: string) => {
  if (providerId) {
    return executeViaBackgroundScript('wallet_signMessage', [providerId, messageToSign, address]);
  }
  return executeViaBackgroundScript('personal_sign', [messageToSign, address]);
};

const handleSiweLogin = async (address: string, providerId?: string) => {
  try {
    const checksumAddress = getAddress(address);
    const nonceResponse = await getSiweNonce();
    const nonce = nonceResponse.data.nonce;
    const chainIdValue = await getCurrentChainId(providerId);
    const chainId = chainIdValue?.startsWith('0x') ? Number.parseInt(chainIdValue, 16) : Number(chainIdValue);

    const siweMessage = new SiweMessage({
      domain: 'linklayer.ai',
      address: checksumAddress,
      statement: 'Sign in with Ethereum to LinkLayer AI Agent',
      uri: API_BASE_URL.replace(/\/$/, ''), // 移除末尾的斜杠
      version: '1',
      chainId: Number.isNaN(chainId) ? 1 : chainId,
      nonce,
    });

    const messageToSign = siweMessage.prepareMessage();
    const signature = await signMessageWithProvider(messageToSign, checksumAddress, providerId);
    const inviteCode = window.localStorage.getItem(INVITE_CODE_KEY) || '';

    const result = await verifySiweMessage({
      message: messageToSign,
      signature,
      invite_code: inviteCode,
    });

    window.localStorage.setItem(ACCESS_TOKEN_KEY, result.data.access_token);
    window.localStorage.setItem(ADDRESS_KEY, result.data.address || checksumAddress);

    store.dispatch(
      setUserInfo({
        access_token: result.data.access_token,
        address: result.data.address || checksumAddress,
      }),
    );
    store.dispatch(syncPoints());
    try {
      const userInfo = await get_user_info();
      if (userInfo?.data) {
        store.dispatch(setOtherInfo(userInfo.data));
      }
    } catch (error) {
      console.error('[App] Failed to load user info:', error);
    }

    message.success('Login successful!');

    const addressChangedEvent = new CustomEvent('addressChanged', {
      detail: { address: result.data.address || checksumAddress },
    });
    window.dispatchEvent(addressChangedEvent);

    return true;
  } catch (error) {
    console.error('SIWE login failed:', error);
    message.error('Login failed. Please try again.');
    return false;
  }
};

// 内部内容组件 - 使用本地状态管理
const SidePanelContentInner = () => {
  // 使用本地状态而不是 Wagmi hooks
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false); // 记录用户是否主动退出
  const [metaMaskRestarted, setMetaMaskRestarted] = useState(false); // MetaMask 是否重启
  const isLoadingRef = useRef(false);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  const selectedMenuId = useSelector((state: RootState) => state.ui.selectedMenuId);
  const isOpen = useSelector((state: RootState) => state.ui.isSidePanelOpen);
  const currentPageKey = pageKeyMap[selectedMenuId] ?? 'alpha';
  const pageInfo = useSelector(selectPageInfo(currentPageKey));

  // 同步 pageInfo 翻译
  usePageInfoSync();
  // 加载保存的钱包状态
  useEffect(() => {
    const loadWalletState = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      try {
        // 确保 wallet 事件监听器已注入
        chrome.runtime.sendMessage({ type: 'ENSURE_WALLET_LISTENERS' }, response => {
          console.log('[App] Wallet listeners ensured:', response);
        });

        const savedState = await WalletStorage.loadWalletState();

        if (savedState.isConnected && savedState.address) {
          // 先恢复显示状态（立即响应）
          setWalletAddress(savedState.address);
          setChainId(savedState.chainId);
          setIsConnected(true);
          setProviderId(savedState.providerId || null);
          setManuallyDisconnected(false); // 清除主动退出标志

          // 延迟验证连接是否仍然有效（避免时序问题）
          // 等待一小段时间让 MetaMask 完全注入
          setTimeout(async () => {
            try {
              const currentAccounts = await getCurrentAccounts(savedState.providerId || undefined);
              const currentProviderId = await getProviderId();

              // 检查 provider ID 是否变化（MetaMask 重启检测）
              if (
                isProviderInstanceId(savedState.providerId) &&
                currentProviderId &&
                currentProviderId !== savedState.providerId
              ) {
                // MetaMask 重启，清除连接状态
                setWalletAddress(null);
                setChainId(null);
                setIsConnected(false);
                setProviderId(null);
                await WalletStorage.clearWalletState();
                return;
              }

              if (currentAccounts.length === 0) {
                // 没有账户，连接已失效
                setWalletAddress(null);
                setChainId(null);
                setIsConnected(false);
                setProviderId(null);
                await WalletStorage.clearWalletState();
              } else if (currentAccounts[0].toLowerCase() !== savedState.address.toLowerCase()) {
                // 账户已切换
                setWalletAddress(currentAccounts[0]);
                const newChainId = await getCurrentChainId(savedState.providerId || undefined);
                const newProviderId = await getProviderId();
                setChainId(newChainId);
                setProviderId(
                  isProviderInstanceId(savedState.providerId) ? newProviderId || null : savedState.providerId || null,
                );
                await WalletStorage.saveWalletState({
                  isConnected: true,
                  address: currentAccounts[0],
                  chainId: newChainId,
                  lastConnected: Date.now(),
                  providerId: newProviderId || undefined,
                });
              } else {
                console.log('[App] Connection verified successfully ✅');
              }
            } catch (error) {
              console.error('[App] Failed to verify connection:', error);
              // 验证失败时保持当前状态，让定期轮询来处理
            }
          }, 500); // 延迟 500ms 验证
        }
      } catch (error) {
        console.error('[App] Failed to load wallet state:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadWalletState();
  }, []);

  // 监听钱包事件
  useEffect(() => {
    const handleMessage = async (request: { type: string; event?: string; data?: any }) => {
      if (request.type === 'OPEN_SIDEPANEL') {
        store.dispatch(setSidePanelOpen(true));

        // 打开侧边栏时立即检查钱包连接状态
        if (isConnected) {
          const currentAccounts = await getCurrentAccounts(providerId || undefined);
          if (currentAccounts.length === 0) {
            console.log('[App] Sidebar opened: No accounts, disconnecting...');
            setWalletAddress(null);
            setChainId(null);
            setIsConnected(false);
            setProviderId(null);
            await WalletStorage.clearWalletState();
          } else if (walletAddress && currentAccounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
            console.log('[App] Sidebar opened: Account changed, updating...');
            setWalletAddress(currentAccounts[0]);
          }
        }
      } else if (request.type === 'WALLET_EVENT_FORWARD') {
        // 处理钱包事件
        console.log('[App] Wallet event:', request.event, request.data);

        switch (request.event) {
          case 'accountsChanged':
            const accounts = request.data?.accounts || [];
            if (accounts.length > 0) {
              // 如果用户主动退出了，忽略账户变化事件
              if (manuallyDisconnected) {
                console.log('[App] Ignoring accountsChanged: user manually disconnected');
                return;
              }

              // 账户变化，更新状态
              const newAddress = accounts[0];
              console.log('[App] Account changed to:', newAddress);
              setWalletAddress(newAddress);
              setIsConnected(true);
              setManuallyDisconnected(false); // 账户变化时清除主动退出标志

              // 更新保存的状态
              const currentProviderId = await getProviderId();
              setProviderId(isProviderInstanceId(providerId) || !providerId ? currentProviderId || null : providerId);
              WalletStorage.saveWalletState({
                isConnected: true,
                address: newAddress,
                chainId,
                lastConnected: Date.now(),
                providerId: currentProviderId || undefined,
              });
            } else {
              // 用户断开连接（锁定钱包等）
              console.log('[App] Accounts changed to empty, disconnecting...');
              setWalletAddress(null);
              setChainId(null);
              setIsConnected(false);
              setManuallyDisconnected(false); // 这不是用户主动退出，是钱包锁定
              setProviderId(null);
              WalletStorage.clearWalletState();
            }
            break;

          case 'chainChanged':
            const newChainId = request.data?.chainId;
            console.log('[App] Chain changed to:', newChainId);
            setChainId(newChainId);

            // 更新保存的状态
            if (isConnected && walletAddress) {
              const currentProviderId = await getProviderId();
              setProviderId(isProviderInstanceId(providerId) || !providerId ? currentProviderId || null : providerId);
              WalletStorage.saveWalletState({
                isConnected: true,
                address: walletAddress,
                chainId: newChainId,
                lastConnected: Date.now(),
                providerId: currentProviderId || undefined,
              });
            }
            break;

          case 'disconnect':
            console.log('[App] Wallet disconnected event received');
            // 如果用户主动退出了，忽略断开事件
            if (manuallyDisconnected) {
              console.log('[App] Ignoring disconnect event: user manually disconnected');
              return;
            }

            setWalletAddress(null);
            setChainId(null);
            setIsConnected(false);
            setManuallyDisconnected(false); // 钱包事件导致的断开，不是用户主动退出
            setProviderId(null);
            WalletStorage.clearWalletState();
            break;

          case 'connect':
            console.log('[App] Wallet connected event');
            // 如果用户主动退出了，忽略 connect 事件
            if (manuallyDisconnected) {
              console.log('[App] Ignoring connect event: user manually disconnected');
              return;
            }

            // connect 事件通常在 wallet 已经连接后触发
            // 我们需要获取当前账户
            getCurrentAccounts(providerId || undefined).then(async accounts => {
              if (accounts.length > 0) {
                const address = accounts[0];
                const currentChainId = await getCurrentChainId(providerId || undefined);
                const currentProviderId = await getProviderId();
                setWalletAddress(address);
                setChainId(currentChainId);
                setIsConnected(true);
                setManuallyDisconnected(false); // 清除主动退出标志
                setProviderId(isProviderInstanceId(providerId) || !providerId ? currentProviderId || null : providerId);

                await WalletStorage.saveWalletState({
                  isConnected: true,
                  address,
                  chainId: currentChainId,
                  lastConnected: Date.now(),
                  providerId: currentProviderId || undefined,
                });
              }
            });
            break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [isConnected, walletAddress, chainId, manuallyDisconnected]);

  // 定期检查钱包连接状态（兜底方案）
  useEffect(() => {
    // 如果未连接或用户主动退出，不启动轮询
    if (!isConnected || manuallyDisconnected) {
      console.log('[App] Periodic check disabled: disconnected or manually disconnected');
      return;
    }

    const checkConnection = async () => {
      try {
        // 如果用户主动退出了，立即停止轮询
        if (manuallyDisconnected) {
          console.log('[App] Periodic check: User manually disconnected, stopping...');
          clearInterval(checkInterval);
          return;
        }

        const currentAccounts = await getCurrentAccounts(providerId || undefined);
        const currentProviderId = await getProviderId();

        if (isProviderInstanceId(providerId) && currentProviderId && currentProviderId !== providerId) {
          console.warn('[App] Periodic check: Provider ID changed, disconnecting...');
          setWalletAddress(null);
          setChainId(null);
          setIsConnected(false);
          setManuallyDisconnected(false);
          setProviderId(null);
          await WalletStorage.clearWalletState();
          return;
        }

        if (isProviderInstanceId(providerId) && !currentProviderId) {
          console.warn('[App] Periodic check: Provider missing, disconnecting...');
          setWalletAddress(null);
          setChainId(null);
          setIsConnected(false);
          setManuallyDisconnected(false);
          setProviderId(null);
          await WalletStorage.clearWalletState();
          return;
        }

        if (isConnected && currentAccounts.length === 0) {
          // 如果之前显示已连接，但现在没有账户了，说明钱包已断开
          console.log('[App] Periodic check: No accounts found, disconnecting...');
          setWalletAddress(null);
          setChainId(null);
          setIsConnected(false);
          setManuallyDisconnected(false); // 这不是用户主动退出
          setProviderId(null);
          await WalletStorage.clearWalletState();
        } else if (isConnected && currentAccounts.length > 0 && walletAddress) {
          const currentAddress = currentAccounts[0];
          if (currentAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            // 如果账户地址不匹配，更新为当前账户
            console.log('[App] Periodic check: Account changed, updating...');
            setWalletAddress(currentAddress);
            const newChainId = await getCurrentChainId(providerId || undefined);
            const newProviderId = await getProviderId();
            setChainId(newChainId);
            setProviderId(isProviderInstanceId(providerId) || !providerId ? newProviderId || null : providerId);
            await WalletStorage.saveWalletState({
              isConnected: true,
              address: currentAddress,
              chainId: newChainId,
              lastConnected: Date.now(),
              providerId: newProviderId || undefined,
            });
          }
        }
        // ❌ 移除自动连接逻辑 - 不要在未连接时自动连接
      } catch (error) {
        console.error('[App] Periodic check failed:', error);
      }
    };

    // 立即执行一次
    checkConnection();

    // 每2秒检查一次
    const checkInterval = setInterval(checkConnection, 2000);

    return () => {
      clearInterval(checkInterval);
      console.log('[App] Periodic check cleaned up');
    };
  }, [isConnected, manuallyDisconnected, walletAddress, chainId, providerId]);

  // 连接钱包函数
  const handleConnectWallet = useCallback(async (providerId?: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      chrome.runtime.sendMessage({ type: 'ENSURE_WALLET_LISTENERS' }, response => {
        console.log('[App] Wallet listeners ensured (connect):', response);
      });

      const hasWallet = await checkPageContextWallet(providerId);
      if (!hasWallet) {
        setConnectionError('No injected wallet detected. Please install and unlock a wallet extension.');
        return;
      }

      const address = await connectPageContextWallet(providerId);
      const detectedProviderId = await getProviderId();
      setWalletAddress(address);
      setIsConnected(true);
      setManuallyDisconnected(false); // Clear manual disconnect flag after connect.
      setProviderId(providerId || detectedProviderId || null);
      await handleSiweLogin(address, providerId);
      console.log('[App] Successfully connected to wallet:', address);
    } catch (error) {
      console.error('[App] Connection failed:', error);
      setConnectionError(error instanceof Error ? error.message : '????');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback((manual: boolean) => {
    // Disconnect wallet and clear local state.
    setWalletAddress(null);
    setChainId(null);
    setIsConnected(false);
    setManuallyDisconnected(manual);
    setProviderId(null);
    WalletStorage.clearWalletState();
    console.log(manual ? '[App] Wallet disconnected by user' : '[App] Wallet disconnected');
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectWallet(true);
  }, [disconnectWallet]);

  useEffect(() => {
    const handleUnauthorized = () => {
      disconnectWallet(false);
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, [disconnectWallet]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('[App] Logout API failed:', error);
    } finally {
      store.dispatch(logoutAction());
      handleDisconnect();
    }
  }, [handleDisconnect]);

  // Popover 打开时同步用户数据和积分
  const handlePopoverOpenChange = useCallback(async (open: boolean) => {
    // 只在打开时同步数据
    if (!open) return;

    try {
      // 并行请求用户信息和积分
      const [userInfoResponse, pointsResponse] = await Promise.allSettled([get_user_info(), user_rewardpoints()]);

      // 处理用户信息 - 从 data 中提取并合并已有的 image
      if (userInfoResponse.status === 'fulfilled' && userInfoResponse.value?.data) {
        const currentOtherInfo = store.getState().user.otherInfo;
        // 使用类型断言明确 data 的类型
        const userData = (userInfoResponse.value as any).data as {
          web3_address: string;
          email: string;
          invite_code: string;
          invite_count: number;
        };
        store.dispatch(
          setOtherInfo({
            web3_address: userData.web3_address,
            email: userData.email,
            invite_code: userData.invite_code,
            invite_count: userData.invite_count,
            image: currentOtherInfo.image || '', // 保留已有的 image
          }),
        );
      } else {
        console.warn('[App] Failed to fetch user info:', userInfoResponse);
      }

      // 处理积分 - 使用 syncPoints thunk
      if (pointsResponse.status === 'fulfilled' && pointsResponse.value?.data?.reward_points !== undefined) {
        store.dispatch(syncPoints());
      } else {
        console.warn('[App] Failed to fetch reward points:', pointsResponse);
      }
    } catch (error) {
      console.error('[App] Failed to sync user data on popover open:', error);
    }
  }, []);

  const handleLoginSuccess = () => {
    // Address is already set by handleConnectWallet
    console.log('[App] Login successful');
  };

  const renderContent = () => {
    // 如果未登录，显示登录组件
    if (!isLogin) {
      return (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onConnect={handleConnectWallet}
          isConnecting={isConnecting}
          connectionError={connectionError}
        />
      );
    }
    // 页面 ID 到 pageInfo key 的映射
    const iconMap = {
      1: getLogo('alpha/alpha.svg'),
      2: getLogo('alpha/api.svg'),
      3: getLogo('alpha/minting.svg'),
      4: getLogo('alpha/perps.svg'),
      5: getLogo('alpha/polit.svg'),
      6: getLogo('alpha/points2.svg'),
    };

    const renderHeader = () => {
      return (
        <h2 className="m-0 text-lg font-semibold text-gray-800">
          <AlphaBg title={pageInfo.title} description={pageInfo.description} icon={iconMap[selectedMenuId]}></AlphaBg>
        </h2>
      );
    };

    return (
      <PageLayout header={renderHeader()}>
        {selectedMenuId === 1 && <Alpha />}
        {selectedMenuId === 2 && <AddApi />}
        {selectedMenuId === 3 && <Minting />}
        {selectedMenuId === 4 && <Perps />}
        {selectedMenuId === 5 && <Politer />}
        {selectedMenuId === 6 && <Points />}
      </PageLayout>
    );
  };
  const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  return (
    <div className="relative text-black">
      {/* 右下角浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => store.dispatch(setSidePanelOpen(true))}
          className={`pointer-events-auto fixed right-4 top-4 z-[11111] h-[50px] w-[50px] cursor-pointer font-sans text-sm text-white shadow-lg transition-all duration-200`}>
          <img src={getLogo('rounded logo.svg')}></img>
        </button>
      )}

      {/* 侧边窗口 */}
      <div
        data-popover-boundary
        className={`pointer-events-auto fixed top-0 z-[9998] flex h-screen w-[500px] bg-white font-sans shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'right-0 opacity-100' : '-right-[500px] opacity-0'
        }`}>
        <div className={'relative flex-1'} id="layout-box">
          {!isLogin && (
            <div className="absolute right-4 top-4 z-[11111]">
              <button
                onClick={() => store.dispatch(setSidePanelOpen(false))}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-xl font-bold text-black">
                ✕
              </button>
            </div>
          )}
          {/* 内容区域 */}
          <div className="w-full">{renderContent()}</div>
        </div>
        {isLogin && (
          <div className="flex w-[74px] flex-col items-center justify-between border-l border-l-2 border-black py-[1.5vh]">
            <div>
              <div className="mb-[2vh] flex items-center justify-center">
                <button
                  onClick={() => store.dispatch(setSidePanelOpen(false))}
                  className="flex h-[4vh] w-[4vh] cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-xl font-bold text-black">
                  ✕
                </button>
              </div>

              {isLogin && (
                <div className="mb-[2vh] flex items-center justify-center">
                  <Popover
                    content={<LoginPanel onLogout={handleLogout} />}
                    placement="topLeft"
                    trigger="click"
                    onOpenChange={handlePopoverOpenChange}>
                    <div className="h-[4.4vh] w-[4.4vh] cursor-pointer overflow-hidden rounded-full bg-[#cf0]">
                      {otherInfo.image ? <img src={otherInfo.image} className="h-full w-full rounded-full" /> : null}
                    </div>
                  </Popover>
                </div>
              )}
              <Menus store={store}></Menus>
            </div>
            <SocialBtns onMenuSelect={id => store.dispatch(setSelectedMenuId(id))} />
          </div>
        )}
      </div>

      {/* 遮罩层 */}
      {isOpen && (
        <div
          role="button"
          tabIndex={-1}
          onClick={() => {
            // 移除焦点，避免 ARIA 警告
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            store.dispatch(setSidePanelOpen(false));
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              store.dispatch(setSidePanelOpen(false));
            }
          }}
          className="pointer-events-auto fixed inset-0 z-[9997] cursor-pointer bg-black/30"
          aria-label="关闭侧边栏"
        />
      )}
    </div>
  );
};

// 侧边面板组件 - IFRAME 方案不需要 Wagmi Provider
const SidePanelContent = () => <SidePanelContentInner />;

// X.com 侧边栏植入组件
const XSidebarInjection = () => {
  const injectedRef = useRef(false);
  const currentPathRef = useRef(window.location.pathname);

  useEffect(() => {
    // 检查域名白名单
    if (!isDomainWhitelisted()) {
      return;
    }

    let observer: MutationObserver | null = null;
    let routeCheckInterval: NodeJS.Timeout | null = null;

    // 移除已植入的元素
    const removeInjectedElement = () => {
      const injectedElement = document.getElementById('agent-injection-element');
      if (injectedElement) {
        injectedElement.remove();
      }
      injectedRef.current = false;
    };

    // 查找 sidebarColumn 元素
    const findAndInject = () => {
      // 使用 ref 检查是否已注入，避免闭包陷阱
      if (injectedRef.current) {
        if (observer) {
          observer.disconnect();
        }
        return;
      }

      const sidebarColumn = document.querySelector('[aria-label="Trending"]');
      if (sidebarColumn) {
        // 检查是否已经存在植入的元素
        const existingElement = document.getElementById('agent-injection-element');
        if (existingElement) {
          injectedRef.current = true;
          if (observer) {
            observer.disconnect();
          }
          return;
        }

        // 创建植入元素
        const injectionElement = document.createElement('div');
        injectionElement.id = 'agent-injection-element';
        injectionElement.className = 'agent-injection';
        injectionElement.style.cssText = `
          padding: 12px 16px;
          margin: 0 0 14px;
          background-color: rgb(255, 255, 255);
          border-radius: 9999px;
          cursor: pointer;
          transition: background-color 0.2s;
        `;

        // 添加鼠标悬停效果
        injectionElement.onmouseenter = () => {
          injectionElement.style.backgroundColor = 'rgb(243, 244, 245)';
        };
        injectionElement.onmouseleave = () => {
          injectionElement.style.backgroundColor = 'rgb(255, 255, 255)';
        };

        // 添加内容
        injectionElement.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 24px; height: 24px; background-color: #7A9900; border-radius: 50%;"></div>
            <span style="font-size: 20px; font-weight: 700; color: rgb(15, 20, 25);">Test implant element

/agent</span>
          </div>
        `;

        // 植入到第一个子元素的第二个元素后面
        const firstChild = sidebarColumn.children[0];
        if (firstChild && firstChild.children[1]) {
          firstChild.children[1].after(injectionElement);
        } else {
          // 如果结构不符合预期，则插入到最前面
          sidebarColumn.prepend(injectionElement);
        }
        injectedRef.current = true;
        console.log('[CEB] Agent element injected into X.com sidebar, path:', window.location.pathname);

        // 注入后立即断开观察者
        if (observer) {
          observer.disconnect();
        }
      }
    };

    // 监听路由变化
    const handleRouteChange = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPathRef.current) {
        console.log('[CEB] Route changed from', currentPathRef.current, 'to', newPath);
        currentPathRef.current = newPath;

        // 移除旧的植入元素
        removeInjectedElement();

        // 重新植入
        setTimeout(() => {
          findAndInject();
        }, 0); // 等待页面渲染完成
      }
    };

    // 立即尝试植入
    findAndInject();

    // 监听 popstate 事件（浏览器前进/后退）
    window.addEventListener('popstate', handleRouteChange);

    // 监听 pushState 和 replaceState（SPA 路由）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleRouteChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleRouteChange();
    };

    // 定时检查路由变化（兜底方案）
    routeCheckInterval = setInterval(() => {
      handleRouteChange();
    }, 1000);

    // 如果元素不存在，使用 MutationObserver 等待
    observer = new MutationObserver(() => {
      findAndInject();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      // 清理监听器
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;

      if (observer) {
        observer.disconnect();
      }
      if (routeCheckInterval) {
        clearInterval(routeCheckInterval);
      }

      // 清理植入的元素
      removeInjectedElement();
    };
  }, []);

  return null;
};

// 主组件
const App = () => {
  useEffect(() => {
    store.dispatch(initializeFromLocalStorage());
  }, []);

  useEffect(() => {
    // 检查域名白名单
    if (!isDomainWhitelisted()) {
      console.log('[CEB] Domain not in whitelist, skipping content script injection');
      return;
    }

    // 检查是否已创建 Shadow DOM
    let container = document.getElementById('sidepanel-shadow-host') as HTMLDivElement;

    if (!container) {
      // 创建 Shadow DOM 容器
      container = document.createElement('div');
      container.id = 'sidepanel-shadow-host';
      container.className = 'shadow-host';
      document.body.appendChild(container);

      // 创建 Shadow Root
      const shadowRoot = container.attachShadow({ mode: 'open' });

      // 创建根元素
      const rootElement = document.createElement('div');
      shadowRoot.appendChild(rootElement);

      // 注入样式到 Shadow DOM（与 initAppWithShadow 相同的方式）
      if (navigator.userAgent.includes('Firefox')) {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = inlineCss;
        shadowRoot.appendChild(styleElement);
      } else {
        const globalStyleSheet = new CSSStyleSheet();
        globalStyleSheet.replaceSync(inlineCss);
        shadowRoot.adoptedStyleSheets = [globalStyleSheet];
      }

      // 渲染 React 应用
      const root = createRoot(rootElement);
      root.render(
        <Provider store={store}>
          <I18nProvider>
            <SidePanelContent />
          </I18nProvider>
        </Provider>,
      );
    }

    return () => {
      // 清理（可选，通常不需要移除 container）
    };
  }, []);

  // 只在白名单域名内才渲染 XSidebarInjection
  if (!isDomainWhitelisted()) {
    return null;
  }

  return <XSidebarInjection />;
};

export default App;
