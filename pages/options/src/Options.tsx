import '@src/Options.css';
import { useState } from 'react';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import AlertPreview from '@src/alert-preview/AlertPreview';

type Tab = 'preview' | 'about';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [tab, setTab] = useState<Tab>('preview');

  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';
  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-black">
      <nav className="border-b-[1.5px] border-black bg-white">
        <div className="mx-auto flex w-full max-w-[1000px] items-center gap-2 px-4 py-2.5">
          <img src={chrome.runtime.getURL(logo)} className="mr-3 h-6" alt="logo" />
          {(
            [
              ['preview', '告警推送预览'],
              ['about', '关于'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'rounded-lg border-2 border-black px-3 py-1.5 text-[12px] font-bold transition-colors',
                tab === key ? 'bg-[#CCFF00] text-black' : 'bg-white text-black/45 hover:bg-[#F4FFC8]',
              )}>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'preview' ? (
        <AlertPreview />
      ) : (
        <div className="mx-auto w-full max-w-[1000px] px-4 py-8">
          <div className="flex flex-col items-center gap-4 rounded-[6.5px] border-[1.5px] border-black bg-white py-12">
            <button onClick={goGithubSite}>
              <img src={chrome.runtime.getURL(logo)} className="h-10" alt="logo" />
            </button>
            <p className="text-[13px] text-black/60">
              Edit <code className="rounded bg-[#F3F3F3] px-1">pages/options/src/Options.tsx</code>
            </p>
            <ToggleButton onClick={exampleThemeStorage.toggle}>{t('toggleTheme')}</ToggleButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
