import { Select, Switch } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { localeOptions } from '@src/lib/i18n/localeOptions';
import type { Locale } from '@src/lib/i18n';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { XPlatformComponent } from './XPlatformComponent';

// ???????????
const PLATFORM_SETTINGS_KEY = 'platform_settings';

// ????????? Map
const platformRoots = new Map<string, any>();

// ???????????? Map
const containerWatchers = new Map<string, NodeJS.Timeout>();

// ??????????????????????????????
const initializeDefaultSettings = () => {
  chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
    if (!result[PLATFORM_SETTINGS_KEY]) {
      const defaultSettings = {
        xEnabled: true,
        binanceEnabled: false,
        okxEnabled: false,
      };
      chrome.storage.local.set({ [PLATFORM_SETTINGS_KEY]: defaultSettings });
    }
  });
};

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState({
    xEnabled: true,
    binanceEnabled: false,
    okxEnabled: false,
  });

  // ??????
  useEffect(() => {
    chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
      if (result[PLATFORM_SETTINGS_KEY]) {
        setSettings(result[PLATFORM_SETTINGS_KEY]);
      }
    });
  }, []);

  // ??????
  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ [PLATFORM_SETTINGS_KEY]: newSettings });

    // ?????????????????????
    window.dispatchEvent(
      new CustomEvent('platformSettingsChanged', {
        detail: { [key]: value },
      }),
    );

    if (key === 'xEnabled') {
      if (value) {
        scheduleQuickRetryInject('x', 5, 200);
      } else {
        removePlatformComponent('x', { cleanupWatchers: true });
      }
    }
  };

  return { settings, updateSetting };
};

// ?????hook???????????????????????????
export const usePlatformInjection = (platform: 'x' | 'binance' | 'okx') => {
  const [isEnabled, setIsEnabled] = useState(false);
  const injectedRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10; // Increase retry attempts for dynamic pages

  const waitForPageLoad = (): Promise<void> => {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener(
          'load',
          () => {
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
    const loadSettings = async () => {
      chrome.storage.local.get([PLATFORM_SETTINGS_KEY], async result => {
        const settings = result[PLATFORM_SETTINGS_KEY] || {
          xEnabled: true,
          binanceEnabled: false,
          okxEnabled: false,
        };

        const enabled =
          platform === 'x' ? settings.xEnabled : platform === 'binance' ? settings.binanceEnabled : settings.okxEnabled;

        setIsEnabled(enabled);

        if (enabled) {
          if (!injectedRef.current) {
            await waitForPageLoad();
            setupRouteWatcher(platform);
            scheduleQuickRetryInject(platform, 5, 200);
          }
        } else {
          removePlatformComponent(platform, { cleanupWatchers: true });
          injectedRef.current = false;
        }
      });
    };

    const findAndInjectPlatform = () => {
      chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
        const settings = result[PLATFORM_SETTINGS_KEY] || {
          xEnabled: true,
          binanceEnabled: false,
          okxEnabled: false,
        };
        const enabled =
          platform === 'x' ? settings.xEnabled : platform === 'binance' ? settings.binanceEnabled : settings.okxEnabled;

        if (!enabled) {
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
          return;
        }

        if (injectedRef.current) {
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
          return;
        }

        const subscribeAnchor = document.querySelector('[aria-label="Subscribe to Premium"][role="complementary"]');
        const relevantPeopleAnchor = document.querySelector('[aria-label="Relevant people"][role="complementary"]');
        const trendingContainer = document.querySelector('[aria-label="Trending"][tabindex="0"]');

        if (subscribeAnchor || relevantPeopleAnchor || trendingContainer) {
          injectPlatformComponent(platform);
          injectedRef.current = true;
          retryCountRef.current = 0;
          if (observerRef.current) {
            observerRef.current.disconnect();
          }
        } else {
          retryCountRef.current++;
          if (retryCountRef.current < maxRetries) {
            setTimeout(() => {
              findAndInjectPlatform();
            }, 1000);
          } else {
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        }
      });
    };

    loadSettings();

    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[PLATFORM_SETTINGS_KEY]) {
        loadSettings();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    const eventListener = () => {
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

const routeWatchers = new Map<string, { cleanup: () => void }>();
const quickRetryTimers = new Map<string, NodeJS.Timeout>();

const injectPlatformComponent = (platform: string) => {
  chrome.storage.local.get([PLATFORM_SETTINGS_KEY], result => {
    const settings = result[PLATFORM_SETTINGS_KEY] || {
      xEnabled: true,
      binanceEnabled: false,
      okxEnabled: false,
    };
    const enabled =
      platform === 'x' ? settings.xEnabled : platform === 'binance' ? settings.binanceEnabled : settings.okxEnabled;

    if (!enabled) {
      return;
    }

    performInjection(platform);
  });
};

const performInjection = (platform: string) => {
  if (platform === 'x') {
    const currentHostname = window.location.hostname.toLowerCase();
    const allowedDomains = ['x.com', 'twitter.com'];

    if (!allowedDomains.includes(currentHostname)) {
      return;
    }
  }

  const elementId = `${platform}-platform-injection`;

  const existingElement = document.getElementById(elementId);
  if (existingElement) {
    return;
  }
  const subscribeAnchor = document.querySelector('[aria-label="Subscribe to Premium"][role="complementary"]');
  const relevantPeopleAnchor = document.querySelector('[aria-label="Relevant people"][role="complementary"]');
  const trendingContainer = document.querySelector('[aria-label="Trending"][tabindex="0"]');

  let container: HTMLDivElement | null = null;

  if (subscribeAnchor) {
    const anchorParent = subscribeAnchor.parentElement ?? null;
    const anchorGrandparent = anchorParent?.parentElement ?? null;
    const insertParent = anchorGrandparent?.parentElement ?? null;

    if (!anchorGrandparent || !insertParent) {
      return;
    }

    container = document.createElement('div');
    container.id = elementId;
    container.className = `${platform}-platform-injection`;

    insertParent.insertBefore(container, anchorGrandparent);
  } else if (relevantPeopleAnchor) {
    const insertParent = relevantPeopleAnchor.parentElement ?? null;
    if (!insertParent) {
      return;
    }

    container = document.createElement('div');
    container.id = elementId;
    container.className = `${platform}-platform-injection`;

    if (!insertParent.parentElement) {
      return;
    }

    insertParent.parentElement.insertBefore(container, insertParent);
  } else if (trendingContainer) {
    const first = trendingContainer.firstElementChild ?? null;
    const firstChildSecond = first?.children?.[1] ?? null;
    const afterFirstChildSecond = firstChildSecond?.nextSibling ?? null;

    if (!first || !firstChildSecond) {
      return;
    }

    container = document.createElement('div');
    container.id = elementId;
    container.className = `${platform}-platform-injection`;

    first.insertBefore(container, afterFirstChildSecond);
  } else {
    return;
  }

  if (!container) {
    return;
  }

  const insertedContainer = document.getElementById(elementId);
  if (!insertedContainer) {
    return;
  }

  try {
    const root = createRoot(container);

    if (platform === 'x') {
      root.render(<XPlatformComponent />);
    }

    platformRoots.set(platform, root);

    setupRouteWatcher(platform);
    setupContainerWatcher(platform, elementId);
  } catch (error) {
    container.remove();
  }
};
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
  // ??????????????????
  const existingWatcher = routeWatchers.get(platform);
  if (existingWatcher) {
    existingWatcher.cleanup();
  }

  let lastUrl = window.location.href;

  const checkUrlChange = () => {
    const currentUrl = window.location.href;
    const elementId = `${platform}-platform-injection`;
    const containerExists = document.getElementById(elementId);

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      setTimeout(() => {
        removePlatformComponent(platform, { cleanupWatchers: false });
        scheduleQuickRetryInject(platform, 5, 200);
      }, 500);
    } else if (!containerExists) {
      setTimeout(() => {
        scheduleQuickRetryInject(platform, 5, 200);
      }, 100);
    }
  };

  const handlePopstate = () => {
    checkUrlChange();
  };
  window.addEventListener('popstate', handlePopstate);

  let observerTimeout: NodeJS.Timeout | null = null;
  const observer = new MutationObserver(mutations => {
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    const hasSignificantChange = mutations.some(mutation => {
      if (mutation.removedNodes.length > 0) {
        const elementId = `${platform}-platform-injection`;
        for (const node of Array.from(mutation.removedNodes)) {
          if (node instanceof HTMLElement) {
            if (node.id === elementId || node.querySelector(`#${elementId}`)) {
              return true;
            }
          }
        }
      }

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

    // ?????????????????
    observerTimeout = setTimeout(() => {
      checkUrlChange();
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style', 'aria-label'],
  });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkUrlChange();
  };

  const handleHashChange = () => {
    checkUrlChange();
  };
  window.addEventListener('hashchange', handleHashChange);

  const cleanup = () => {
    window.removeEventListener('popstate', handlePopstate);
    window.removeEventListener('hashchange', handleHashChange);

    observer.disconnect();

    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }

    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };

  routeWatchers.set(platform, { cleanup });
};

const removePlatformComponent = (platform: string, options?: { cleanupWatchers?: boolean }) => {
  const { cleanupWatchers = true } = options ?? {};
  const elementId = `${platform}-platform-injection`;
  const element = document.getElementById(elementId);

  if (element) {
    const root = platformRoots.get(platform);
    if (root) {
      root.unmount();
      platformRoots.delete(platform);
    }

    element.remove();
  }

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
    }

    const containerWatcher = containerWatchers.get(platform);
    if (containerWatcher) {
      clearInterval(containerWatcher);
      containerWatchers.delete(platform);
    }
  }
};

// ??????????????
const setupContainerWatcher = (platform: string, elementId: string) => {
  const existingWatcher = containerWatchers.get(platform);
  if (existingWatcher) {
    clearInterval(existingWatcher);
  }

  const watcher = setInterval(() => {
    const container = document.getElementById(elementId);
    if (!container) {
      injectPlatformComponent(platform);
    }
  }, 2000);

  containerWatchers.set(platform, watcher);
};

// ???????$????????????????????????
export const PlatformInjectionManager = () => {
  const { settings } = usePlatformSettings();

  useEffect(() => {
    initializeDefaultSettings();
  }, [settings.xEnabled]);

  usePlatformInjection('x');

  return null;
};

export const SettingPanel = ({ children }: { children: React.ReactNode }) => {
  const { locale, changeLocale, t } = useI18n();
  const { settings, updateSetting } = usePlatformSettings();

  const handleLanguageChange = (value: string | number) => {
    const newLocale = value as Locale;
    changeLocale(newLocale);

    try {
      const event = new CustomEvent('ChangeLanguage', { detail: { locale: newLocale } });
      window.dispatchEvent(event);
    } catch (error) {
      // Error silently
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
