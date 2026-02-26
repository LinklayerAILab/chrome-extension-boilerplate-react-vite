import '@src/Popup.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = 'content-ui/rounded logo.svg';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
    }

    await chrome.scripting
      .executeScript({
        target: { tabId: tab.id! },
        files: ['/content-runtime/example.iife.js', '/content-runtime/all.iife.js'],
      })
      .catch(err => {
        // Handling errors related to other paths
        if (err.message.includes('Cannot access a chrome:// URL')) {
          chrome.notifications.create('inject-error', notificationOptions);
        }
      });
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.id) {
      // 发送消息到 content script 打开侧边窗口
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SIDEPANEL' }).catch(err => {
        // 如果 content script 未加载，先注入再发送消息
        console.log('Content script not loaded, injecting...');
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ['/content-ui/all.iife.js'],
          })
          .then(() => {
            // 等待一下确保 content script 已加载
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id!, { type: 'OPEN_SIDEPANEL' });
            }, 100);
          })
          .catch(() => {
            chrome.notifications.create('open-sidepanel-error', {
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icon-34.png'),
              title: '打开侧边窗口失败',
              message: '无法在当前页面打开侧边窗口',
            });
          });
      });
    }
  };

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')}>
      <header className={cn('App-header', isLight ? 'text-gray-900' : 'text-gray-100')}>
        <button onClick={openSidePanel}>
          <img src={chrome.runtime.getURL(logo)} className="App-logo w-[60px] cursor-pointer" alt="logo" />
        </button>
        <button
          className={cn(
            'mt-2 rounded px-4 py-1 font-bold shadow hover:scale-105',
            isLight ? 'bg-green-200 text-black' : 'bg-green-700 text-white',
          )}
          onClick={openSidePanel}>
          Open Window
        </button>
        <ToggleButton>{t('toggleTheme')}</ToggleButton>
      </header>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
