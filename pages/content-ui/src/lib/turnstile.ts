const TURNSTILE_TIMEOUT_MS = 8000;

const getSiteKey = () => {
  // const globalKey = (window as unknown as Record<string, any>).__TURNSTILE_SITE_KEY__;
  // const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  // const envKey = env.VITE_TURNSTILE_SITE_KEY || env.CEB_TURNSTILE_SITE_KEY;

  // if (!globalKey && !envKey) {
  //   console.warn('[Turnstile] Missing site key: __TURNSTILE_SITE_KEY__ or VITE_TURNSTILE_SITE_KEY/CEB_TURNSTILE_SITE_KEY');
  // }
  return '0x4AAAAAABumtc8awhc2e8Zy';
};

let pendingTurnstilePromise: Promise<string | null> | null = null;

export const requestTurnstileToken = (timeoutMs: number = TURNSTILE_TIMEOUT_MS): Promise<string | null> => {
  if (pendingTurnstilePromise) {
    return pendingTurnstilePromise;
  }

  const siteKey = getSiteKey();
  if (!siteKey) {
    return Promise.resolve(null);
  }

  if (!chrome?.runtime?.sendMessage) {
    console.warn('[Turnstile] chrome.runtime.sendMessage is not available');
    return Promise.resolve(null);
  }

  pendingTurnstilePromise = new Promise(resolve => {
    let finished = false;
    const requestId = `turnstile_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      pendingTurnstilePromise = null;
      chrome.runtime.onMessage.removeListener(handleMessage);
      window.clearTimeout(timeoutId);
    };

    const handleMessage = (message: any) => {
      if (!message || message.type !== 'TURNSTILE_TOKEN_RESPONSE') return;
      if (message.requestId !== requestId) return;

      if (message.token) {
        console.debug('[Turnstile] token received');
        cleanup();
        resolve(message.token);
        return;
      }

      console.warn('[Turnstile] token failed:', message.error || 'unknown');
      cleanup();
      resolve(null);
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    const timeoutId = window.setTimeout(() => {
      console.warn('[Turnstile] token timeout');
      cleanup();
      resolve(null);
    }, timeoutMs);

    console.debug('[Turnstile] executing turnstile request');
    chrome.runtime.sendMessage({
      type: 'TURNSTILE_TOKEN_REQUEST',
      requestId,
      sitekey: siteKey,
      action: 'content-ui',
      theme: 'light',
    });
  });

  return pendingTurnstilePromise;
};
