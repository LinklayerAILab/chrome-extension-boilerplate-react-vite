import { Select, Switch } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { localeOptions } from '@src/lib/i18n/localeOptions';
import type { Locale } from '@src/lib/i18n';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { XPlatformComponent } from './XPlatformComponent';

// 平台设置存储键
const PLATFORM_SETTINGS_KEY = 'platform_settings';

// 存储根引用的 Map
const platformRoots = new Map<string, any>();

// 存储容器监控器的 Map
const containerWatchers = new Map<string, NodeJS.Timeout>();

// 初始化默认设置（确保首次安装时设置存在）
const initializeDefaultSettings = () => {
  chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
    if (!result[PLATFORM_SETTINGS_KEY]) {
      const defaultSettings = {
        xEnabled: true,
        binanceEnabled: false,
        okxEnabled: false,
      };
      chrome.storage.local.set({ [PLATFORM_SETTINGS_KEY]: defaultSettings }, () => {
        console.log('[PlatformSettings] Default settings initialized:', defaultSettings);
      });
    }
  });
};

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState({
    xEnabled: true,
    binanceEnabled: false,
    okxEnabled: false,
  });

  // 加载设置
  useEffect(() => {
    chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
      if (result[PLATFORM_SETTINGS_KEY]) {
        setSettings(result[PLATFORM_SETTINGS_KEY]);
      }
    });
  }, []);

  // 更新设置
  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ [PLATFORM_SETTINGS_KEY]: newSettings });

    // 派发自定义事件，通知其他组件
    window.dispatchEvent(
      new CustomEvent('platformSettingsChanged', {
        detail: { [key]: value },
      }),
    );
  };

  return { settings, updateSetting };
};

// 自定义 hook：根据平台设置控制宿主页面组件的注入
export const usePlatformInjection = (platform: 'x' | 'binance' | 'okx') => {
  const [isEnabled, setIsEnabled] = useState(false);
  const injectedRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10; // 增加重试次数

  // 等待页面完全加载
  const waitForPageLoad = (): Promise<void> => {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        console.log('[PlatformInjection] Page already loaded');
        resolve();
      } else {
        console.log('[PlatformInjection] Waiting for page to load...');
        window.addEventListener(
          'load',
          () => {
            console.log('[PlatformInjection] Page load event fired');
            // 额外等待一段时间，确保 Twitter 的动态内容加载完成
            setTimeout(() => {
              resolve();
            }, 2000);
          },
          { once: true },
        );
      }
    });
  };

  useEffect(() => {
    console.log(`[PlatformInjection] Hook initialized for platform: ${platform}`);

    // 监听存储变化
    const loadSettings = async () => {
      chrome.storage.local.get([PLATFORM_SETTINGS_KEY], async result => {
        // 如果 storage 中没有数据，使用默认值（首次安装时）
        const settings = result[PLATFORM_SETTINGS_KEY] || {
          xEnabled: true,
          binanceEnabled: false,
          okxEnabled: false,
        };

        const enabled =
          platform === 'x' ? settings.xEnabled : platform === 'binance' ? settings.binanceEnabled : settings.okxEnabled;

        console.log(`[PlatformInjection] Settings loaded for ${platform}:`, settings, `enabled: ${enabled}`);

        setIsEnabled(enabled);

        // 根据状态注入或移除组件
        if (enabled && !injectedRef.current) {
          console.log(`[PlatformInjection] ${platform} is enabled and not injected, waiting for page load`);
          // 等待页面完全加载
          await waitForPageLoad();
          console.log(`[PlatformInjection] Page loaded, calling findAndInjectPlatform`);
          findAndInjectPlatform();
        } else if (!enabled && injectedRef.current) {
          removePlatformComponent(platform, { cleanupWatchers: true });
          injectedRef.current = false;
        }
      });
    };

    // 查找并注入组件（带重试机制）
    const findAndInjectPlatform = () => {
      if (injectedRef.current) {
        console.log(`[PlatformInjection] Already injected, skipping...`);
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        return;
      }

      console.log(
        `[PlatformInjection] Attempting to find and inject ${platform} (attempt ${retryCountRef.current + 1}/${maxRetries})...`,
      );
      console.log(`[PlatformInjection] Current URL: ${window.location.href}`);
      console.log(`[PlatformInjection] DOM ready state: ${document.readyState}`);

      // 先输出所有带 aria-label 的元素帮助调试
      const allAriaLabels = Array.from(document.querySelectorAll('[aria-label]'));
      console.log(
        `[PlatformInjection] All elements with aria-label:`,
        allAriaLabels.map(el => ({
          tag: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          class: el.className,
        })),
      );

      // 尝试多个可能的选择器
      const possibleSelectors = [
        '[aria-label="Trending"][tabindex="0"]',
        '[aria-label="Trending"]',
        '[aria-label="What\'s happening"]',
        '[data-testid="sidebarColumn"]',
      ];

      let targetElement = null;
      for (const selector of possibleSelectors) {
        targetElement = document.querySelector(selector);
        if (targetElement) {
          console.log(`[PlatformInjection] Found element using selector: ${selector}`);
          break;
        }
      }

      if (targetElement) {
        console.log(`[PlatformInjection] Found target element, injecting ${platform} component`);
        injectPlatformComponent(platform);
        injectedRef.current = true;
        retryCountRef.current = 0; // 重置重试计数
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        console.log(`[PlatformInjection] Successfully injected ${platform} component`);
      } else {
        console.log(`[PlatformInjection] Target element not found with any selector, will retry...`);
        retryCountRef.current++;
        if (retryCountRef.current < maxRetries) {
          // 延迟重试，给 Twitter 更多时间加载
          console.log(`[PlatformInjection] Scheduling retry ${retryCountRef.current + 1}/${maxRetries} in 1 second...`);
          setTimeout(() => {
            if (!injectedRef.current) {
              findAndInjectPlatform();
            }
          }, 1000);
        } else {
          console.warn(`[PlatformInjection] Max retries (${maxRetries}) reached for ${platform}. Stopping observer.`);
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
        }
      }
    };

    // 初始加载
    console.log(`[PlatformInjection] Calling loadSettings for initial setup...`);
    loadSettings();

    // 监听存储变化
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[PLATFORM_SETTINGS_KEY]) {
        console.log(`[PlatformInjection] Storage changed, reloading settings...`);
        loadSettings();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // 监听自定义事件
    const eventListener = () => {
      console.log(`[PlatformInjection] Platform settings changed event received`);
      loadSettings();
    };

    window.addEventListener('platformSettingsChanged', eventListener);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      chrome.storage.onChanged.removeListener(storageListener);
      window.removeEventListener('platformSettingsChanged', eventListener);
    };
  }, [platform]);

  return isEnabled;
};

// 存储路由监听器的 Map
const routeWatchers = new Map<string, { cleanup: () => void }>();

// ????????????? Map
const quickRetryTimers = new Map<string, NodeJS.Timeout>();

// 注入 React 组件到宿主页面
const injectPlatformComponent = (platform: string) => {
  // 延时100ms后再执行注入
  setTimeout(() => {
    // 对于 X 平台，检查当前域名是否为 x.com 或 twitter.com
    if (platform === 'x') {
      const currentHostname = window.location.hostname.toLowerCase();
      const allowedDomains = ['x.com', 'twitter.com'];

      if (!allowedDomains.includes(currentHostname)) {
        console.log(
          `[PlatformInjection] Current hostname "${currentHostname}" is not allowed for X platform injection. Skipping injection.`,
        );
        return;
      }

      console.log(`[PlatformInjection] Hostname check passed: ${currentHostname} is allowed for X platform injection.`);
    }

    const elementId = `${platform}-platform-injection`;

    // 详细日志：开始注入流程
    console.log(`[PlatformInjection] Starting injection for ${platform} after 100ms delay...`);

    // 检查是否已存在
    const existingElement = document.getElementById(elementId);
    if (existingElement) {
      console.log(`[PlatformInjection] Element ${elementId} already exists, skipping`);
      return;
    }

    // 尝试多个可能的选择器查找插入位置
    const possibleSelectors = [
      '[aria-label="Trending"][tabindex="0"]',
      '[aria-label="Trending"]',
      '[aria-label="What\'s happening"]',
      '[data-testid="sidebarColumn"]',
    ];

    let targetElement = null;
    let parentElement = null;
    let insertPosition = 'prepend'; // 默认插入方式

    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // 对于 Trending 元素，特殊处理插入位置
        if (selector.includes('[aria-label="Trending"]')) {
          // 找到第一个子元素
          const firstChild = element.firstElementChild;
          if (firstChild && firstChild.children.length >= 1) {
            // 获取第一个子元素
            const firstOfFirstChild = firstChild.children[0];
            targetElement = firstOfFirstChild;
            parentElement = firstChild;
            insertPosition = 'after';
            console.log(`[PlatformInjection] Found Trending element, will inject after 1st child of first child`);
            console.log(`[PlatformInjection] First child:`, firstChild);
            console.log(`[PlatformInjection] First child's first child:`, firstOfFirstChild);
            break;
          }
        }
        // 其他元素使用默认插入方式
        targetElement = element;
        parentElement = null;
        insertPosition = 'prepend';
        console.log(`[PlatformInjection] Found target container using selector: ${selector}`);
        break;
      }
    }

    if (!targetElement) {
      console.warn(
        `[PlatformInjection] Target container not found with any selector. Current page:`,
        window.location.href,
      );
      console.log(
        '[PlatformInjection] Available aria-label elements:',
        Array.from(document.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label')),
      );
      return;
    }

    console.log(`[PlatformInjection] Found target element:`, targetElement);

    // 创建容器元素
    const container = document.createElement('div');
    container.id = elementId;
    container.className = `${platform}-platform-injection`;

    // 根据插入位置类型插入容器
    if (insertPosition === 'after' && parentElement) {
      // 在第一个子元素的第一个子元素后面插入
      if (targetElement.nextSibling) {
        parentElement.insertBefore(container, targetElement.nextSibling);
        console.log(`[PlatformInjection] Container inserted after 1st child in first child element`);
      } else {
        // 如果没有下一个兄弟元素，直接追加到第一个子元素末尾
        parentElement.appendChild(container);
        console.log(`[PlatformInjection] Container appended to first child element`);
      }
    } else {
      // 插入到目标元素的开头
      targetElement.prepend(container);
      console.log(`[PlatformInjection] Container prepended to target element`);
    }

    // 验证容器已插入
    const insertedContainer = document.getElementById(elementId);
    if (!insertedContainer) {
      console.error(`[PlatformInjection] Failed to insert container into DOM`);
      return;
    }

    console.log(`[PlatformInjection] Container successfully inserted into DOM`);

    try {
      // 创建 React 根并渲染组件
      const root = createRoot(container);

      if (platform === 'x') {
        root.render(<XPlatformComponent />);
      }

      // 存储根引用以便后续卸载
      platformRoots.set(platform, root);

      console.log(`[PlatformInjection] ${platform} React component injected successfully!`);

      // 设置路由监听
      setupRouteWatcher(platform);

      // 设置容器存在性监控
      setupContainerWatcher(platform, elementId);
    } catch (error) {
      console.error(`[PlatformInjection] Failed to create React root or render component:`, error);
      // 清理失败的容器
      container.remove();
    }
  }, 100); // 延时100ms
};

// 设置路由监听器
const scheduleQuickRetryInject = (platform: string, attempts = 5, intervalMs = 200) => {
  const existing = quickRetryTimers.get(platform);
  if (existing) {
    clearTimeout(existing);
  }

  let remaining = attempts;
  const tick = () => {
    injectPlatformComponent(platform);
    remaining -= 1;
    if (remaining > 0) {
      const timer = setTimeout(tick, intervalMs);
      quickRetryTimers.set(platform, timer);
    } else {
      quickRetryTimers.delete(platform);
    }
  };

  const timer = setTimeout(tick, 0);
  quickRetryTimers.set(platform, timer);
};

const setupRouteWatcher = (platform: string) => {
  // 如果已经有监听器，先清理
  const existingWatcher = routeWatchers.get(platform);
  if (existingWatcher) {
    existingWatcher.cleanup();
  }

  let lastUrl = window.location.href;
  console.log(`[RouteWatcher] Setting up route watcher for ${platform}, initial URL: ${lastUrl}`);

  // 监听 URL 变化的方法
  const checkUrlChange = () => {
    const currentUrl = window.location.href;
    const elementId = `${platform}-platform-injection`;
    const containerExists = document.getElementById(elementId);

    // 检查 URL 是否变化 或 容器是否被移除（主题切换可能导致容器被移除）
    if (currentUrl !== lastUrl) {
      console.log(`[RouteWatcher] URL changed for ${platform}:`);
      console.log(`  Old: ${lastUrl}`);
      console.log(`  New: ${currentUrl}`);

      lastUrl = currentUrl;

      // URL 变化时重新注入组件
      console.log(`[RouteWatcher] Re-injecting ${platform} component due to route change`);

      // 延迟一下，确保页面 DOM 已更新
      setTimeout(() => {
        // ???????
        removePlatformComponent(platform, { cleanupWatchers: false });
        // ????????????
        scheduleQuickRetryInject(platform, 5, 200);
      }, 500);
    } else if (!containerExists) {
      // URL 没变但容器不存在（可能是主题切换导致的 DOM 重新渲染）
      console.log(`[RouteWatcher] Container ${elementId} not found (possibly due to theme switch), re-injecting...`);

      // 延迟一下，确保 DOM 已稳定
      setTimeout(() => {
        scheduleQuickRetryInject(platform, 5, 200);
      }, 100);
    }
  };

  // 方法1：使用 popstate 监听浏览器前进/后退
  const handlePopstate = () => {
    console.log(`[RouteWatcher] popstate event detected`);
    checkUrlChange();
  };
  window.addEventListener('popstate', handlePopstate);

  // 方法2：使用 MutationObserver 监听 DOM 变化（SPA 路由变化通常不触发 popstate）
  // Twitter/X 是单页应用，需要监听 DOM 变化来检测路由变化和主题切换
  let observerTimeout: NodeJS.Timeout | null = null;
  const observer = new MutationObserver(mutations => {
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    // 检查是否有重要的 DOM 变化
    const hasSignificantChange = mutations.some(mutation => {
      // 检查是否有子节点被移除（主题切换可能会移除我们的容器）
      if (mutation.removedNodes.length > 0) {
        const elementId = `${platform}-platform-injection`;
        for (const node of Array.from(mutation.removedNodes)) {
          if (node instanceof HTMLElement) {
            // 检查是否移除了我们的容器或其父元素
            if (node.id === elementId || node.querySelector(`#${elementId}`)) {
              console.log(`[RouteWatcher] Detected removal of injected container due to theme switch`);
              return true;
            }
          }
        }
      }

      // 检查是否有属性变化（主题切换通常会改变 class 和 data-theme 属性）
      if (
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'class' ||
          mutation.attributeName === 'data-theme' ||
          mutation.attributeName === 'style')
      ) {
        return true;
      }

      return false;
    });

    // 防抖处理，避免频繁触发
    observerTimeout = setTimeout(() => {
      if (hasSignificantChange) {
        console.log(`[RouteWatcher] Detected significant DOM change, checking container...`);
      }
      checkUrlChange();
    }, 100);
  });

  // 监听 document.body 的子树变化，包括属性变化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style', 'aria-label'],
  });

  // 方法3：监听 pushstate 和 replacestate（Twitter 路由变化的常见方式）
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    console.log(`[RouteWatcher] pushState called`);
    checkUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    console.log(`[RouteWatcher] replaceState called`);
    checkUrlChange();
  };

  // 方法4：监听 Twitter 特定的路由变化事件
  const handleHashChange = () => {
    console.log(`[RouteWatcher] hashchange event detected`);
    checkUrlChange();
  };
  window.addEventListener('hashchange', handleHashChange);

  // 清理函数
  const cleanup = () => {
    console.log(`[RouteWatcher] Cleaning up route watcher for ${platform}`);

    window.removeEventListener('popstate', handlePopstate);
    window.removeEventListener('hashchange', handleHashChange);

    observer.disconnect();

    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    // 恢复原始的 history 方法
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };

  // 存储清理函数
  routeWatchers.set(platform, { cleanup });

  console.log(`[RouteWatcher] Route watcher setup complete for ${platform}`);
};

// 移除平台组件
const removePlatformComponent = (platform: string, options?: { cleanupWatchers?: boolean }) => {
  const { cleanupWatchers = true } = options ?? {};
  const elementId = `${platform}-platform-injection`;
  const element = document.getElementById(elementId);

  if (element) {
    // 卸载 React 组件
    const root = platformRoots.get(platform);
    if (root) {
      root.unmount();
      platformRoots.delete(platform);
    }

    // 移除 DOM 元素
    element.remove();
    console.log(`[PlatformInjection] ${platform} component removed`);
  }

  // 清理路由监听器
  if (cleanupWatchers) {
    const quickRetryTimer = quickRetryTimers.get(platform);
    if (quickRetryTimer) {
      clearTimeout(quickRetryTimer);
      quickRetryTimers.delete(platform);
    }

    const routeWatcher = routeWatchers.get(platform);
    if (routeWatcher) {
      routeWatcher.cleanup();
      routeWatchers.delete(platform);
      console.log(`[PlatformInjection] Route watcher removed for ${platform}`);
    }

    const containerWatcher = containerWatchers.get(platform);
    if (containerWatcher) {
      clearInterval(containerWatcher);
      containerWatchers.delete(platform);
      console.log(`[PlatformInjection] Container watcher removed for ${platform}`);
    }
  }
};

// 设置容器存在性监控
const setupContainerWatcher = (platform: string, elementId: string) => {
  // 清理旧的监控器
  const existingWatcher = containerWatchers.get(platform);
  if (existingWatcher) {
    clearInterval(existingWatcher);
  }

  // 每2秒检查一次容器是否还存在
  const watcher = setInterval(() => {
    const container = document.getElementById(elementId);
    if (!container) {
      console.log(`[ContainerWatcher] Container ${elementId} not found, re-injecting...`);
      injectPlatformComponent(platform);
    }
  }, 2000);

  containerWatchers.set(platform, watcher);
  console.log(`[ContainerWatcher] Started watching container ${elementId} for platform ${platform}`);
};

// 平台注入管理器组件（在页面加载时就会渲染）
export const PlatformInjectionManager = () => {
  const { settings } = usePlatformSettings();

  // 页面加载时立即检查并注入
  useEffect(() => {
    console.log('[PlatformInjectionManager] Component mounted');
    console.log('[PlatformInjectionManager] Current URL:', window.location.href);

    // 首先初始化默认设置
    initializeDefaultSettings();

    // 延迟检查，确保设置已初始化
    setTimeout(() => {
      chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
        console.log('[PlatformInjectionManager] Settings from storage after init:', result);
        const currentSettings = result[PLATFORM_SETTINGS_KEY];
        if (currentSettings) {
          console.log('[PlatformInjectionManager] xEnabled from storage:', currentSettings.xEnabled);
        }
      });
    }, 200);

    console.log('[PlatformInjectionManager] Initial settings:', settings);
    console.log('[PlatformInjectionManager] xEnabled:', settings.xEnabled);

    if (settings.xEnabled) {
      console.log(
        '[PlatformInjectionManager] xEnabled is true, component will be injected by usePlatformInjection hook',
      );
    } else {
      console.log('[PlatformInjectionManager] xEnabled is false, component will NOT be injected');
    }
  }, [settings.xEnabled]);

  // 使用 hook 控制 X 平台组件的注入
  usePlatformInjection('x');

  return null; // 不渲染任何 UI
};

export const SettingPanel = ({ children }: { children: React.ReactNode }) => {
  const { locale, changeLocale, t } = useI18n();
  const { settings, updateSetting } = usePlatformSettings();

  const handleLanguageChange = (value: string | number) => {
    const newLocale = value as Locale;
    changeLocale(newLocale);

    // 触发自定义语言切换事件，通知其他页面更新翻译
    try {
      const event = new CustomEvent('ChangeLanguage', { detail: { locale: newLocale } });
      window.dispatchEvent(event);
      console.log('[SettingPanel] ChangeLanguage event dispatched:', newLocale);
    } catch (error) {
      console.error('[SettingPanel] Failed to dispatch ChangeLanguage event:', error);
    }
  };

  return (
    <div className="flex w-[200px] max-w-md flex-col gap-2 rounded-lg bg-white">
      <div className="text-[18px] font-bold text-[#333333]">{t.settings.title}</div>
      <div className="flex items-center justify-between">
        <span>{t.settings.language}</span>
        <Select
          variant="borderless"
          size="small"
          value={locale}
          options={localeOptions}
          onChange={handleLanguageChange}
        />
      </div>
      <div className="mb-2 h-[1px] bg-[#eee]"></div>
      <div className="mb-2">{t.settings.pluginPermissions}</div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold">X</div>
        <Switch checked={settings.xEnabled} onChange={checked => updateSetting('xEnabled', checked)} />
      </div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold">Binance</div>
        <Switch
          checked={settings.binanceEnabled}
          onChange={checked => updateSetting('binanceEnabled', checked)}
          disabled
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="font-bold">OKX</div>
        <Switch checked={settings.okxEnabled} onChange={checked => updateSetting('okxEnabled', checked)} disabled />
      </div>
    </div>
  );
};
