(() => {
  const FRAME_URL = 'https://cdn.linklayer.ai/uploads/turnstile.html';
  const FRAME_ID = 'turnstile-frame';

  let iframe = null;
  let pending = null;
  let currentKey = '';
  let currentAction = '';
  let currentTheme = '';

  const buildFrameSrc = (sitekey, action, theme) => {
    const url = new URL(FRAME_URL);
    url.searchParams.set('sitekey', sitekey);
    url.searchParams.set('action', action);
    url.searchParams.set('theme', theme);
    return url.toString();
  };

  const ensureIframe = (sitekey, action, theme) => {
    const key = `${sitekey}|${action}|${theme}`;

    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = FRAME_ID;
      iframe.style.cssText =
        'position: fixed; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
      iframe.addEventListener('load', () => {
        chrome.runtime.sendMessage({
          type: 'TURNSTILE_DEBUG',
          message: 'iframe-load',
          src: iframe?.src,
        });
      });
      iframe.addEventListener('error', () => {
        chrome.runtime.sendMessage({
          type: 'TURNSTILE_DEBUG',
          message: 'iframe-load-error',
          src: iframe?.src,
        });
      });
      document.body.appendChild(iframe);
    }

    if (key !== currentKey) {
      currentKey = key;
      currentAction = action;
      currentTheme = theme;
      iframe.src = buildFrameSrc(sitekey, action, theme);
    }

    return iframe;
  };

  const sendExecute = () => {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'turnstile-execute' }, '*');
  };

  const sendReset = () => {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'turnstile-reset' }, '*');
  };

  window.addEventListener('message', event => {
    if (event.source !== iframe?.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'turnstile-frame-ready' || data.type === 'turnstile-ready') {
      chrome.runtime.sendMessage({
        type: 'TURNSTILE_DEBUG',
        message: data.type,
      });
      sendExecute();
      return;
    }

    if (!pending) return;

    if (data.type === 'turnstile-token' && data.token) {
      const { resolve, timeoutId } = pending;
      pending = null;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      sendReset();
      resolve(data.token);
      return;
    }

    if (data.type === 'turnstile-debug') {
      chrome.runtime.sendMessage({
        type: 'TURNSTILE_DEBUG',
        message: data.message,
        detail: data.detail,
      });
      return;
    }

    if (data.type === 'turnstile-error' || data.type === 'turnstile-expired') {
      chrome.runtime.sendMessage({
        type: 'TURNSTILE_DEBUG',
        message: data.type,
        detail: data.detail,
      });
      const { reject, timeoutId } = pending;
      pending = null;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      sendReset();
      reject(new Error(data.detail ? `${data.type}:${data.detail}` : data.type));
    }
  });

  const clearPending = error => {
    if (!pending) return;
    const { reject, timeoutId } = pending;
    pending = null;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    sendReset();
    if (error) {
      reject(error);
    }
  };

  const execute = (sitekey, action, theme, timeoutMs = 8000) => {
    if (pending) {
      clearPending(new Error('turnstile-cancelled'));
    }

    ensureIframe(sitekey, action, theme);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        clearPending(new Error('turnstile-timeout'));
      }, timeoutMs);
      pending = { resolve, reject, timeoutId };
      sendExecute();
    });
  };

  chrome.runtime.onMessage.addListener(message => {
    if (message.type !== 'TURNSTILE_TOKEN_REQUEST') return;

    const { requestId, sitekey, action = 'content-ui', theme = 'light' } = message;

    execute(sitekey, action, theme)
      .then(token => {
        chrome.runtime.sendMessage({
          type: 'TURNSTILE_TOKEN_RESPONSE',
          requestId,
          token,
        });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'TURNSTILE_TOKEN_RESPONSE',
          requestId,
          error: error?.message || String(error),
        });
      });
  });
})();
