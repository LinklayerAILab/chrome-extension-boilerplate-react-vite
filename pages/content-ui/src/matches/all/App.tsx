import { AddApi } from './components/AddApi';
import { Alpha } from './components/Alpha';
import { Login } from './components/Login';
import { Minting } from './components/Minting';
import { Perps } from './components/Perps';
import { Politer } from './components/Politer';
import { Points } from './components/Points';
import { Token } from './components/Token';
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
import { PlatformInjectionManager } from './components/SettingPanel';

// 使用 chrome.runtime.getURL 获取扩展资源
const getLogo = (path: string) => chrome.runtime.getURL(`content-ui/${path}`);
import { message } from '@src/ui';
import { RootState, store } from '@src/store';
import { logout as logoutApi } from '@src/api/user';
import {
  clearUserData,
  initializeFromLocalStorage,
  logout as logoutAction,
  setOtherInfo,
  setUserInfo,
  syncPoints,
} from '@src/store/slices/userSlice';
import { setSelectedMenuId, setSidePanelOpen } from '@src/store/slices/uiSlice';
import { refreshGuardEntitlement, resetGuardState } from '@src/store/slices/guardSlice';
import { clearGuardPushAuth, enableGuardPush, ensureGuardPushSync } from '@src/lib/guardPush';
import { setAccountSwitching } from '@src/lib/sessionCleanup';
import { syncPushLangForCurrentUser } from '@src/api/guardLang';
import { AccountPage } from './components/AccountPage';
import { SiweMessage } from 'siwe';
import { getAddress } from 'viem';
import { getSiweNonce, validate_token, verifySiweMessage } from '@src/api/user';
import { get_user_info } from '@src/api/agent_c';
import { autoConfirmPendingClaims } from './lib/claimLlax';
import { API_BASE_URL } from '@src/api/config';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, INVITE_CODE_KEY } from '@src/lib/storageKeys';
import { useSelector } from 'react-redux';
import { selectPageInfo } from '@src/store/slices/pageInfoSlice';
import { usePageInfoSync } from '@src/lib/hooks/usePageInfoSync';

const envValues = (process.env as Record<string, string | undefined>) ?? {};
// 环境分流用 CEB_ENV（dev / test / prod），不能用 CLI_CEB_DEV：
// build:test 是生产构建形态，但需要走测试 SIWE 域名。
const IS_TEST_ENV = (envValues.CEB_ENV ?? 'prod') !== 'prod';

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

const pageKeyMap: Record<number, 'alpha' | 'api' | 'earn' | 'perps' | 'poliet' | 'points' | 'token' | 'account'> = {
  1: 'alpha',
  2: 'api',
  3: 'earn',
  4: 'perps',
  5: 'poliet',
  6: 'points',
  7: 'token',
  8: 'account',
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
      const rawMessage = obj.message;
      if (typeof rawMessage === 'string') {
        return extractCoreMessage(rawMessage);
      }
    }

    return extractCoreMessage(String(input));
  };

  return normalize(errorInput);
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
          reject(new Error(normalizeWeb3ErrorMessage(error)));
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
      // console.log('[App] Provider ID:', response.result);
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

/**
 * 获取当前连接的钱包账户。
 *
 * 返回值语义必须严格区分（冷启动误报「钱包已断开」的根因）：
 * - `string[]`      查询成功；空数组 = 钱包**确证**没有账户（真的断开了）
 * - `null`          查询失败（钱包扩展尚未注入 / RPC 报错 / 桥接超时）
 *
 * 早期实现把异常统一 `return []`，于是浏览器冷启动、钱包扩展还没注入时，
 * 调用方会把「暂时问不到」当成「已经断开」，进而 `clearWalletState()`
 * 永久清除连接存档 —— 即使钱包稍后就绪也无法自动恢复，用户必须手动重连。
 * 因此调用方**只能**在明确拿到空数组时才断开，`null` 一律跳过本轮。
 */
const getCurrentAccounts = async (providerId?: string): Promise<string[] | null> => {
  try {
    const accounts = providerId
      ? await executeViaBackgroundScript('wallet_getAccounts', [providerId])
      : await executeViaBackgroundScript('eth_accounts', []);
    // 桥接层成功但返回非数组（provider 未就绪）同样视为查询失败
    if (!Array.isArray(accounts)) return null;
    return accounts;
  } catch (error) {
    console.warn('[App] Failed to get current accounts (provider may not be ready):', error);
    return null;
  }
};

const getCurrentChainId = async (providerId?: string): Promise<string> => {
  return providerId
    ? await executeViaBackgroundScript('wallet_getChainId', [providerId])
    : await executeViaBackgroundScript('eth_chainId', []);
};

/**
 * 旧版 provider 标识：`{"isMetaMask":true,"chainId":...,"selectedAddress":...}`。
 * 它是**易变状态的快照**（锁屏/切链就变），拿来做「钱包是否重启」的比较必然误判，
 * 正是重启电脑后误报「钱包已断开」的根因。仅用于识别并迁移历史存档。
 */
const isLegacyProviderId = (value?: string | null): boolean => Boolean(value && value.startsWith('{'));

/**
 * 可用于比较的 provider 标识（新版稳定身份，如 `metamask-0` / `eip6963:io.metamask`）。
 * 旧版 JSON 快照不稳定，不参与比较 —— 它会在加载存档时被迁移清除。
 */
const isProviderInstanceId = (value?: string | null): boolean => Boolean(value && !isLegacyProviderId(value));

/** 等待钱包就绪的轮询参数：浏览器冷启动时扩展注入可能耗时数秒 */
const WALLET_READY_POLL_INTERVAL_MS = 300;
const WALLET_READY_TIMEOUT_MS = 5000;

/**
 * 轮询等待钱包就绪，供冷启动恢复使用。
 *
 * 用条件轮询取代固定 setTimeout：固定延时要么太短（冷启动时钱包还没注入，
 * 于是误判断开），要么太长（正常启动白等）。这里一旦拿到**明确结果**就立即返回。
 *
 * @returns
 * - `string[]` 已就绪（空数组同样算就绪 —— 属于钱包确证无账户）
 * - `null`     超时仍未就绪。调用方**不得**据此断开，应保持现状交给周期检查。
 */
const waitForWalletAccounts = async (
  providerId?: string,
  timeoutMs: number = WALLET_READY_TIMEOUT_MS,
): Promise<string[] | null> => {
  const deadline = Date.now() + timeoutMs;
  // 首次立即查询，避免正常启动场景白等一个轮询间隔
  for (;;) {
    const accounts = await getCurrentAccounts(providerId);
    if (accounts !== null) return accounts;
    if (Date.now() >= deadline) return null;
    await new Promise(resolve => setTimeout(resolve, WALLET_READY_POLL_INTERVAL_MS));
  }
};

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
      domain: IS_TEST_ENV ? envValues.CEB_TEST_SIWE_DOMAIN : envValues.CEB_PROD_SIWE_DOMAIN,
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

    /**
     * 拿到新 token 后、写入新状态前，先清空与用户绑定的旧数据。
     *
     * 为什么必须先清：refreshGuardEntitlement / syncPoints 的 fulfilled reducer
     * 只在 payload 非空时赋值（guardSlice.ts:59-62、userSlice.ts:97-100），
     * 新账号请求失败时会静默保留上一个账号的权益、积分、用户资料 —— 用户看到的
     * 是别人的数据。先归零再拉取，失败也只会是空态，不会串号。
     */
    store.dispatch(resetGuardState());
    store.dispatch(clearUserData());

    window.localStorage.setItem(ACCESS_TOKEN_KEY, result.data.access_token);
    window.localStorage.setItem(ADDRESS_KEY, result.data.address || checksumAddress);

    store.dispatch(
      setUserInfo({
        access_token: result.data.access_token,
        address: result.data.address || checksumAddress,
      }),
    );
    store.dispatch(syncPoints());
    // 登录/账号切换后同步 Guard 权益（状态、到期时间、关注位上限、静音状态）
    store.dispatch(refreshGuardEntitlement());
    /**
     * 推送语言是用户级设置，新账号在服务端大概率还是 auto。
     * 本地若已有明确语言（用户选过 / 浏览器语言），立刻推给服务端，
     * 否则新账号的告警推送会用默认语言渲染，与界面不一致。
     * 用 await 保证在后续业务请求之前完成，避免首条推送语言错乱。
     */
    try {
      await syncPushLangForCurrentUser();
    } catch (error) {
      // 语言同步失败不阻断登录流程
      console.warn('[App] Sync push language failed:', error);
    }
    /**
     * 账号切换后把新 token 同步给 background。
     *
     * 注意这里不能再用 isGuardPushEnabled() 做前置判断：该开关的真相源是
     * chrome.storage.local 的 guardPushState，即「background 当前是否在轮询」。
     * 换号前 background 持有的是旧账号的 token，若因为某种原因被清空（例如旧
     * token 的 401），前置判断会直接跳过同步，于是新账号再也不会轮询。
     * 这里改为无条件同步——用户既然登录成功，就该按当前账号轮询；用户主动
     * 关闭过推送的情况由 GUARD_PUSH_DISABLE 在登出路径处理。
     */
    await enableGuardPush().catch(err => console.warn('[App] Re-enable guard push failed:', err));
    try {
      const userInfo = await get_user_info();
      if (userInfo?.data) {
        store.dispatch(setOtherInfo(userInfo.data));
      }
    } catch (error) {
      console.error('[App] Failed to load user info:', error);
    }

    message.success('Login successful!');

    autoConfirmPendingClaims(checksumAddress).catch(err => {
      console.warn('[App] Auto-confirm pending claims failed:', err);
    });

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

// 模块级开关：防止账户切换时 accountsChanged 事件与 2s 轮询并发触发重复登录
let accountSwitchInProgress = false;

/** 切换结束后继续保持屏蔽 401 清理的时长：覆盖旧 token 请求的延迟返回 */
const ACCOUNT_SWITCH_GUARD_MS = 10_000;

// 检测到钱包账户切换时，自动用新账户重新走 SIWE 登录
// 成功时 setUserInfo 会直接覆盖旧 token/address（不调用后端 logout）
const handleAccountSwitch = async (newAddress: string, providerId?: string | null): Promise<void> => {
  const loggedInAddress = store.getState().user.address;
  // 相同账户（忽略 checksum 大小写差异）无需重新登录
  if (loggedInAddress && loggedInAddress.toLowerCase() === newAddress.toLowerCase()) {
    return;
  }

  if (accountSwitchInProgress) {
    return;
  }
  accountSwitchInProgress = true;
  // 切换期间屏蔽 401 会话清理：旧 token 的过渡态 401 不应触发全局登出，
  // 否则会连本地 guard-push-auth 一起清掉，导致轮询永久停止。
  setAccountSwitching(true);
  try {
    const ok = await handleSiweLogin(newAddress, providerId ?? undefined);
    if (!ok) {
      // 重新签名失败（用户拒绝/取消）→ 仅本地清会话回到登录页，保持钱包已连接，用户可再次点击连接
      store.dispatch(logoutAction());
      // 必须同时停掉 background 的告警轮询：它还持有上一个账号的 token，
      // 不清的话用户已经"登出"却仍会收到旧账号的告警通知。
      clearGuardPushAuth();
      message.warning('Signature cancelled. Please sign in again with the new account.');
    }
  } finally {
    accountSwitchInProgress = false;
    // 切换结束后需等新 token 的请求落定再恢复 401 清理，
    // 否则延迟返回的旧 token 401 仍会触发全局登出。
    window.setTimeout(() => setAccountSwitching(false), ACCOUNT_SWITCH_GUARD_MS);
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
  /**
   * 冷启动宽限期截止时刻（时间戳）。
   *
   * 浏览器重启后钱包扩展要数秒才完成注入，期间会先推 `accountsChanged: []`
   * 或 `disconnect`（MetaMask 在网络未就绪时发 4900）。这些是**瞬时的未就绪信号**，
   * 不是真的断开。在此窗口内收到的断开类事件一律忽略，避免 `clearWalletState()`
   * 把存档永久清掉 —— 这正是重启后误报「钱包已断开」的事件路径根因。
   */
  const walletGraceUntilRef = useRef(0);
  const [buttonTopPosition, setButtonTopPosition] = useState(0);
  const [hasCustomPosition, setHasCustomPosition] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [didDrag, setDidDrag] = useState(false);
  const [isFloatingButtonHovered, setIsFloatingButtonHovered] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(true);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const dragStartPoint = useRef({ x: 0, y: 0 });
  const dragButtonRef = useRef<HTMLDivElement>(null);
  const isLogin = useSelector((state: RootState) => state.user.isLogin);
  /**
   * 当前登录地址。
   * 用作 Politer 的 key：切换钱包账号时 dispatch(setUserInfo) 会更新它，
   * key 变化让 React 销毁并重建整个模块，一次性清空所有 tab 的本地 state
   * （关注列表的 is_watched、看板数据、日报流等），避免残留上一个账号的数据。
   */
  const userAddress = useSelector((state: RootState) => state.user.address);
  const selectedMenuId = useSelector((state: RootState) => state.ui.selectedMenuId);
  const isOpen = useSelector((state: RootState) => state.ui.isSidePanelOpen);
  const currentPageKey = pageKeyMap[selectedMenuId] ?? 'alpha';
  const pageInfo = useSelector(selectPageInfo(currentPageKey));

  // 同步 pageInfo 翻译
  usePageInfoSync();

  const clampButtonPosition = useCallback((top: number) => {
    const rect = dragButtonRef.current?.getBoundingClientRect();
    const buttonHeight = rect?.height ?? 32;
    const maxTop = Math.max(0, window.innerHeight - buttonHeight);

    return Math.min(Math.max(top, 0), maxTop);
  }, []);

  useEffect(() => {
    const currentDomain = window.location.hostname;
    const storageKey = `floatingButtonPosition_${currentDomain}`;

    chrome.storage.local.get([storageKey], result => {
      const storedPosition = result[storageKey];
      if (!storedPosition) return;

      if (typeof storedPosition.top === 'number') {
        setButtonTopPosition(clampButtonPosition(storedPosition.top));
        setHasCustomPosition(true);
      }
    });
  }, [clampButtonPosition]);

  useEffect(() => {
    if (isDragging || !hasCustomPosition) return;
    const currentDomain = window.location.hostname;
    const storageKey = `floatingButtonPosition_${currentDomain}`;

    chrome.storage.local.set({
      [storageKey]: { top: buttonTopPosition },
    });
  }, [buttonTopPosition, isDragging, hasCustomPosition]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const rect = dragButtonRef.current?.getBoundingClientRect();
      const buttonHeight = rect?.height ?? 32;
      const maxTop = Math.max(0, window.innerHeight - buttonHeight);

      // 只允许垂直拖动
      const newTop = e.clientY - dragStartOffset.current.y;
      setButtonTopPosition(Math.min(Math.max(newTop, 0), maxTop));

      const movedY = Math.abs(e.clientY - dragStartPoint.current.y);
      if (movedY > 2) {
        setDidDrag(true);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = '';
      }
    };

    if (isDragging) {
      document.body.style.cursor = '';
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (!hasCustomPosition) return;

    const handleResize = () => {
      setButtonTopPosition(current => clampButtonPosition(current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampButtonPosition, hasCustomPosition]);
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
        // 明确打印关键字段：控制台里 Object 是折叠的，无法判断是否进了恢复分支
        console.log(
          '[App] Wallet state snapshot:',
          JSON.stringify({
            isConnected: savedState.isConnected,
            address: savedState.address,
            chainId: savedState.chainId,
            providerId: savedState.providerId,
            lastConnected: savedState.lastConnected,
          }),
        );

        // 迁移：旧存档存的是易变的 JSON 快照（{"isMetaMask":true,"chainId":...}）。
        // 它既不能用于「钱包是否重启」的比较，直接丢弃又会让老用户白丢一次连接状态。
        // 这里改为丢弃该字段、把真实身份交给下方重新检测后写回。
        // 注意：不能清 providerId 就立刻 save —— 必须先确认钱包仍然连接，
        // 否则会把「已断开」误固化成有效存档。因此仅在内存中置空，validation 通过后再落盘。
        let effectiveProviderId = savedState.providerId;
        if (isLegacyProviderId(effectiveProviderId)) {
          console.log('[App] Migrating legacy provider id snapshot:', effectiveProviderId);
          effectiveProviderId = undefined;
        }

        if (savedState.isConnected && savedState.address) {
          console.log('[App] Restoring wallet state, entering startup grace window');
          // 进入冷启动宽限期：钱包注入完成前推来的断开类事件不可信
          walletGraceUntilRef.current = Date.now() + WALLET_READY_TIMEOUT_MS;
          // 先恢复显示状态（立即响应）
          setWalletAddress(savedState.address);
          setChainId(savedState.chainId);
          setIsConnected(true);
          setProviderId(effectiveProviderId || null);
          setManuallyDisconnected(false); // 清除主动退出标志

          // 等待钱包注入完成后再验证（条件轮询，非固定延时）
          // 冷启动时浏览器刚拉起，扩展要数秒才能把 provider 注入页面
          void (async () => {
            try {
              const currentAccounts = await waitForWalletAccounts(effectiveProviderId);

              // 超时仍拿不到结果：钱包可能永远不注入（被禁用/卸载），但**不能**在此断开。
              // 保持已恢复的显示状态，把判定权交给周期检查（它会在下次成功查询时纠偏）。
              if (currentAccounts === null) {
                console.warn('[App] Wallet not ready within timeout, keep last known state for periodic check');
                return;
              }

              const currentProviderId = await getProviderId();

              // 同一个钱包可能有多种 ID 形式（`eip6963:io.metamask` / `metamask-0`），
              // 取决于 EIP-6963 注册表是否已就绪。直接按字符串比较会把同一钱包
              // 误判为「已重启」并清档 —— 这正是重启后误报「钱包已断开」的原因。
              // 因此先用**账户地址**判断是否还是同一个连接：地址一致就绝不断开。
              const sameAccount =
                currentAccounts.length > 0 &&
                !!savedState.address &&
                currentAccounts[0].toLowerCase() === savedState.address.toLowerCase();

              if (
                !sameAccount &&
                isProviderInstanceId(effectiveProviderId) &&
                currentProviderId &&
                currentProviderId !== effectiveProviderId
              ) {
                console.warn(
                  '[App] Provider id changed and account missing, disconnecting. saved:',
                  effectiveProviderId,
                  'current:',
                  currentProviderId,
                );
                // 钱包重启，清除连接状态
                setWalletAddress(null);
                setChainId(null);
                setIsConnected(false);
                setProviderId(null);
                await WalletStorage.clearWalletState();
                return;
              }

              if (currentAccounts.length === 0) {
                // 钱包明确返回空账户，连接已失效
                setWalletAddress(null);
                setChainId(null);
                setIsConnected(false);
                setProviderId(null);
                await WalletStorage.clearWalletState();
              } else if (savedState.address && currentAccounts[0].toLowerCase() !== savedState.address.toLowerCase()) {
                // 账户已切换
                setWalletAddress(currentAccounts[0]);
                const newChainId = await getCurrentChainId(effectiveProviderId);
                const newProviderId = await getProviderId();
                setChainId(newChainId);
                setProviderId(newProviderId || effectiveProviderId || null);
                await WalletStorage.saveWalletState({
                  isConnected: true,
                  address: currentAccounts[0],
                  chainId: newChainId,
                  lastConnected: Date.now(),
                  providerId: newProviderId || undefined,
                });

                // 账户切换后自动用新账户重新登录
                await handleAccountSwitch(currentAccounts[0], effectiveProviderId);
              } else {
                // 账户一致：把迁移后的稳定 id 写回存档（旧版存档首次升级时走这里）。
                // 同时同步 React 状态，否则 setProviderId 仍是迁移前的值，
                // 后续周期检查会拿旧值比较。
                if (currentProviderId && currentProviderId !== savedState.providerId) {
                  setProviderId(currentProviderId);
                  await WalletStorage.saveWalletState({
                    isConnected: true,
                    address: savedState.address,
                    chainId: savedState.chainId,
                    lastConnected: Date.now(),
                    providerId: currentProviderId,
                  });
                }
                console.log('[App] Connection verified successfully ✅');
              }
            } catch (error) {
              console.error('[App] Failed to verify connection:', error);
              // 验证失败时保持当前状态，让定期轮询来处理
            }
          })();
        } else {
          // 存档缺失（首次使用 / 旧版本清过 / 存档被误清），但钱包扩展可能仍记得
          // 本站点的授权：`eth_accounts` 在已授权时会直接返回账户且**不会弹窗**。
          // 此时静默重建存档，避免用户被迫手动重连一次。
          // 注意：绝不调用 eth_requestAccounts/钱包弹窗 —— 必须由用户主动操作触发。
          console.log('[App] No saved wallet state, probing silently for existing authorization...');
          void (async () => {
            try {
              // 必须用 waitForWalletAccounts 而不是 getCurrentAccounts：
              // 挂载瞬间钱包扩展通常还没注入，直接查会得到 null 并放弃，
              // 白白错过「钱包仍记得本站授权」的自动恢复机会。
              const accounts = await waitForWalletAccounts();
              if (accounts === null) {
                console.log('[App] Wallet not ready for silent probe, skip (periodic check will retry)');
                return;
              }
              if (accounts.length === 0) {
                console.log('[App] Wallet not authorized for this site, stay disconnected');
                return;
              }
              const address = accounts[0];
              const grantedChainId = await getCurrentChainId();
              const detectedProviderId = await getProviderId();
              console.log('[App] Existing wallet authorization found, restoring silently:', address);

              // 进入宽限期，避免随后的瞬时事件把刚恢复的状态又清掉
              walletGraceUntilRef.current = Date.now() + WALLET_READY_TIMEOUT_MS;
              setWalletAddress(address);
              setChainId(grantedChainId);
              setIsConnected(true);
              setProviderId(detectedProviderId || null);
              setManuallyDisconnected(false);
              await WalletStorage.saveWalletState({
                isConnected: true,
                address,
                chainId: grantedChainId,
                lastConnected: Date.now(),
                providerId: detectedProviderId || undefined,
              });
            } catch (error) {
              console.log('[App] Silent wallet restore skipped:', error);
            }
          })();
        }
      } catch (error) {
        console.error('[App] Failed to load wallet state:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadWalletState();

    // 挂载时确定性验证登录 token：服务端过期（约 24h）立即触发清理，而非等随机 API 401
    if (window.localStorage.getItem(ACCESS_TOKEN_KEY)) {
      validate_token().catch(() => {
        // 网络失败不登出（离线场景）；401 由 service 拦截器统一清理
      });
    }
  }, []);

  // 监听钱包事件
  useEffect(() => {
    const handleMessage = async (request: { type: string; event?: string; data?: any }) => {
      if (request.type === 'OPEN_SIDEPANEL') {
        store.dispatch(setSidePanelOpen(true));
        // 每次打开侧边栏都校准一次推送轮询（幂等），修复可能被清空的 background 状态
        ensureGuardPushSync();

        // 打开侧边栏时立即检查钱包连接状态
        if (isConnected) {
          const currentAccounts = await getCurrentAccounts(providerId || undefined);
          // null = 钱包尚未就绪，跳过本轮，保持现有显示状态
          if (currentAccounts === null) {
            console.log('[App] Sidebar opened: wallet not ready, skip check');
          } else if (currentAccounts.length === 0) {
            console.log('[App] Sidebar opened: No accounts, disconnecting...');
            setWalletAddress(null);
            setChainId(null);
            setIsConnected(false);
            setProviderId(null);
            await WalletStorage.clearWalletState();
          } else if (walletAddress && currentAccounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
            console.log('[App] Sidebar opened: Account changed, updating...');
            setWalletAddress(currentAccounts[0]);

            // 账户切换后自动用新账户重新登录
            await handleAccountSwitch(currentAccounts[0], providerId);
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

              // 账户切换后自动用新账户重新登录
              await handleAccountSwitch(newAddress, providerId);
            } else {
              // 钱包报空账户。但冷启动宽限期内这多半是「扩展尚未注入完成」的瞬时信号，
              // 而非用户真的断开 —— 此时清存档会让用户永久丢失连接，必须重新检测确认。
              if (Date.now() < walletGraceUntilRef.current) {
                console.log('[App] accountsChanged empty during startup grace, re-checking before disconnect...');
                const verified = await getCurrentAccounts(providerId || undefined);
                // null = 仍问不到（未就绪）；非空 = 已恢复。两种情况都不断开。
                if (verified === null || verified.length > 0) {
                  if (verified && verified.length > 0) {
                    setWalletAddress(verified[0]);
                    setIsConnected(true);
                  }
                  break;
                }
              }
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
            console.log('[App] Wallet disconnected event received', request.data);
            // 如果用户主动退出了，忽略断开事件
            if (manuallyDisconnected) {
              console.log('[App] Ignoring disconnect event: user manually disconnected');
              return;
            }
            // 冷启动宽限期内忽略：MetaMask 在 RPC 未就绪时发 code=4900，
            // 属于瞬时故障而非用户断开。宽限期内清存档会导致无法自动恢复。
            if (Date.now() < walletGraceUntilRef.current) {
              console.log('[App] Ignoring disconnect event during startup grace');
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
              // null = 查询失败；connect 事件会再次触发，无需在此处理
              if (accounts && accounts.length > 0) {
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
  }, [isConnected, walletAddress, chainId, manuallyDisconnected, providerId]);

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

        // 查询失败（钱包扩展重载/未就绪/桥接超时）：跳过本轮，不当作断开。
        // 冷启动时这里最容易误判，一旦 clearWalletState 就再也恢复不了。
        if (currentAccounts === null) {
          console.log('[App] Periodic check: wallet not ready, skip this round');
          return;
        }

        // 与加载存档时同样的判据：地址一致就说明还是同一个连接，
        // providerId 形式差异（eip6963 vs type-index）不能作为断开依据。
        const sameAccount =
          currentAccounts.length > 0 &&
          !!walletAddress &&
          currentAccounts[0].toLowerCase() === walletAddress.toLowerCase();

        if (!sameAccount && isProviderInstanceId(providerId) && currentProviderId && currentProviderId !== providerId) {
          console.warn('[App] Periodic check: Provider ID changed, disconnecting...');
          setWalletAddress(null);
          setChainId(null);
          setIsConnected(false);
          setManuallyDisconnected(false);
          setProviderId(null);
          await WalletStorage.clearWalletState();
          return;
        }

        // 取不到 provider ID = 钱包扩展尚未注入（冷启动/扩展重载），与「已卸载」无法区分。
        // 此时 currentAccounts 已成功返回，说明 provider 其实在，仅为 ID 解析时序问题。
        // 若在此处断开，会把一次瞬时的 ID 读取失败升级成永久的连接丢失，因此跳过本轮。
        if (isProviderInstanceId(providerId) && !currentProviderId) {
          console.log('[App] Periodic check: provider id unavailable, skip this round');
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

            // 账户切换后自动用新账户重新登录
            await handleAccountSwitch(currentAddress, providerId);
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
      // 登录过期只意味着「会话失效」，与钱包连接是两件事：
      // 钱包仍可正常解锁、地址仍有效，用户重新登录即可继续。
      // 此处原先调用 disconnectWallet(false)，会 clearWalletState() 把钱包存档
      // 永久清掉 —— 叠加 token 约 24h 过期，用户隔天开机就会丢失钱包连接，
      // 正是重启电脑后「钱包已断开」的另一个根因。
      // 现在只取消 UI 上的连接标记，保留存档，让下次挂载能自动恢复地址。
      console.log('[App] Session unauthorized: keep wallet storage for auto-restore');
      setIsConnected(false);
      setManuallyDisconnected(false);
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('[App] Logout API failed:', error);
    } finally {
      store.dispatch(logoutAction());
      // 停止 background 的告警通知轮询
      clearGuardPushAuth();
      handleDisconnect();
    }
  }, [handleDisconnect]);

  // Points 兜底重连成功后同步钱包状态（App 是钱包状态的唯一写者）
  const handleWalletReconnected = useCallback(
    async (state: { address: string; chainId: string | null; providerId?: string }) => {
      setWalletAddress(state.address);
      setChainId(state.chainId);
      setIsConnected(true);
      setManuallyDisconnected(false);
      setProviderId(state.providerId ?? null);

      await WalletStorage.saveWalletState({
        isConnected: true,
        address: state.address,
        chainId: state.chainId,
        lastConnected: Date.now(),
        providerId: state.providerId,
      });

      // 解锁后若活动账户变化，自动用新账户重跑 SIWE 登录（同账户时 no-op）
      await handleAccountSwitch(state.address, state.providerId);
    },
    [],
  );

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
    const iconMap: Record<number, string> = {
      1: getLogo('alpha/alpha.svg'),
      2: getLogo('alpha/api.svg'),
      3: getLogo('alpha/minting.svg'),
      4: getLogo('alpha/perps.svg'),
      5: getLogo('alpha/polit.svg'),
      6: getLogo('alpha/points.svg'),
      7: getLogo('alpha/token.svg'),
      8: getLogo('account/account-banner.svg'),
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
        {selectedMenuId === 5 && <Politer key={userAddress} />}
        {selectedMenuId === 7 && <Token />}
        {selectedMenuId === 8 && (
          <AccountPage
            onLogout={handleLogout}
            walletAddress={walletAddress || ''}
            walletChainId={chainId || ''}
            providerId={providerId || ''}
            isConnected={isConnected}
          />
        )}
        {selectedMenuId === 6 && (
          <Points
            walletConnected={isConnected}
            walletAddress={walletAddress || ''}
            providerId={providerId || ''}
            walletChainId={chainId || ''}
            onWalletReconnected={handleWalletReconnected}
          />
        )}
      </PageLayout>
    );
  };
  const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  return (
    <div className="relative text-black">
      {/* 平台注入管理器 - 页面加载时立即执行 */}
      <PlatformInjectionManager />

      {/* 右下角浮动按钮 */}
      {!isOpen && showFloatingButton && (
        <div
          ref={dragButtonRef}
          className="open-button pointer-events-auto fixed z-[11111] flex cursor-pointer rounded-bl-full rounded-tl-full bg-white py-2 pl-3 hover:bg-[#cf0]"
          style={{
            right: '0px',
            top: hasCustomPosition ? `${buttonTopPosition}px` : '20px',
            // filter: 'drop-shadow(0 8px 6px rgb(0 0 0 / 0.2))',
            transition: isDragging ? 'none' : 'width 200ms ease-in-out, filter 200ms ease-in-out',
          }}
          onClick={e => {
            if (!didDrag) {
              store.dispatch(setSidePanelOpen(true));
            }
          }}
          // onMouseEnter={(e) => {
          //   setIsFloatingButtonHovered(true);
          //   if (!isDragging) {
          //     e.currentTarget.style.filter = 'drop-shadow(0 20px 15px rgb(0 0 0 / 0.35))';
          //   }
          // }}
          // onMouseLeave={(e) => {
          //   setIsFloatingButtonHovered(false);
          //   if (!isDragging) {
          //     e.currentTarget.style.filter = 'drop-shadow(0 10px 8px rgb(0 0 0 / 0.1))';
          //   }
          // }}
          onMouseDown={e => {
            if (e.button !== 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            dragStartOffset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
            dragStartPoint.current = { x: e.clientX, y: e.clientY };
            setDidDrag(false);

            if (!hasCustomPosition) {
              setButtonTopPosition(clampButtonPosition(rect.top));
              setHasCustomPosition(true);
            }

            setIsDragging(true);
            e.preventDefault();
          }}>
          <img
            src={getLogo('close.svg')}
            className="open-close-button absolute left-[-3px] top-[-3px] cursor-pointer"
            alt="Close"
            onClick={e => {
              e.stopPropagation();
              setShowFloatingButton(false);
            }}></img>

          <button className="pointer-events-none h-[30px] w-[30px] rounded-full font-sans text-sm text-white transition-all duration-200">
            <img
              src={getLogo(isFloatingButtonHovered ? 'botRounded-a.svg' : 'botRound.svg')}
              className="h-full w-full rounded-full border-[1px] border-solid border-[#B5DF2E]"
              alt="Bot"></img>
          </button>
        </div>
      )}

      {/* 侧边窗口 */}
      <div
        data-popover-boundary
        className={`pointer-events-auto fixed top-0 z-[9998] flex h-screen w-[560px] bg-white font-sans shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'right-0 opacity-100' : '-right-[500px] opacity-0'
        }`}>
        <div className={`layout-box relative flex-1 ${selectedMenuId === 7 && 'page-token'}`} id="layout-box">
          {!isLogin && (
            <div className="absolute right-4 top-4 z-[11111]">
              <button
                onClick={() => store.dispatch(setSidePanelOpen(false))}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-xl font-bold text-black">
                ✕
              </button>
            </div>
          )}
          {/* 内容区域（h-full 让 PageLayout / Politer 的 h-full 有确定的高度基准） */}
          <div className="h-full w-full">{renderContent()}</div>
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
                  <button
                    type="button"
                    aria-label="My Account"
                    className={`h-[4.4vh] w-[4.4vh] cursor-pointer overflow-hidden rounded-full bg-[#cf0] transition-opacity hover:opacity-80 ${
                      selectedMenuId === 8 ? 'ring-2 ring-black ring-offset-1' : ''
                    }`}
                    onClick={() => store.dispatch(setSelectedMenuId(8))}>
                    {otherInfo.image ? <img src={otherInfo.image} className="h-full w-full rounded-full" /> : null}
                  </button>
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

// 主组件
const App = () => {
  useEffect(() => {
    store.dispatch(initializeFromLocalStorage());
    /**
     * 自愈：本地标记已开启通知、但 background 的 guardPushState 已被清空时
     * （例如账号切换期间的 401 清理），这里重新把登录态同步过去，重建轮询。
     * 该调用幂等，正常情况只是刷新一次 alarm。
     */
    ensureGuardPushSync();
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

  // return <XSidebarInjection />;
};

export default App;
