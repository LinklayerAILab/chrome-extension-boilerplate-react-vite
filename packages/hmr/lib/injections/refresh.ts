import initClient from '../initializers/init-client.js';

(() => {
  let pendingReload = false;

  const getWhitelistDomains = (): string[] => {
    const raw = (window as typeof window & { __CONTENT_UI_WHITELIST_DOMAINS__?: string })
      .__CONTENT_UI_WHITELIST_DOMAINS__;

    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map(domain => domain.trim())
      .filter(Boolean);
  };

  const isDomainWhitelisted = (): boolean => {
    const hostname = window.location.hostname;
    const whitelist = getWhitelistDomains();

    if (whitelist.length === 0) {
      return false;
    }

    return whitelist.some(domain => {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
      }

      return hostname === domain;
    });
  };

  initClient({
    // @ts-expect-error That's because of the dynamic code loading
    id: __HMR_ID,
    onUpdate: () => {
      if (!isDomainWhitelisted()) {
        return;
      }
      // disable reload when tab is hidden
      if (document.hidden) {
        pendingReload = true;
        return;
      }
      reload();
    },
  });

  // reload
  const reload = (): void => {
    pendingReload = false;
    window.location.reload();
  };

  // reload when tab is visible
  const reloadWhenTabIsVisible = (): void => {
    if (!document.hidden && pendingReload) {
      reload();
    }
  };

  document.addEventListener('visibilitychange', reloadWhenTabIsVisible);
})();
