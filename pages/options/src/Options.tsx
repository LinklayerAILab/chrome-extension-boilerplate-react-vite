import '@src/Options.css';
import { useState } from 'react';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import AlertPreview from '@src/alert-preview/AlertPreview';

type Tab = 'preview' | 'home';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [tab, setTab] = useState<Tab>('preview');

  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';
  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  return (
    <div className={cn('min-h-screen', isLight ? 'bg-slate-50 text-gray-900' : 'bg-gray-800 text-gray-100')}>
      <nav className="flex items-center gap-1 border-b border-gray-300 bg-white px-4 py-2">
        <img src={chrome.runtime.getURL(logo)} className="mr-3 h-6" alt="logo" />
        {(
          [
            ['preview', '告警推送预览'],
            ['home', '关于'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-md px-3 py-1 text-[13px] transition-colors',
              tab === key ? 'bg-black font-semibold text-white' : 'text-gray-600 hover:bg-gray-100',
            )}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'preview' ? (
        <AlertPreview />
      ) : (
        <div className="App">
          <button onClick={goGithubSite}>
            <img src={chrome.runtime.getURL(logo)} className="App-logo" alt="logo" />
          </button>
          <p>
            Edit <code>pages/options/src/Options.tsx</code>
          </p>
          <ToggleButton onClick={exampleThemeStorage.toggle}>{t('toggleTheme')}</ToggleButton>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
