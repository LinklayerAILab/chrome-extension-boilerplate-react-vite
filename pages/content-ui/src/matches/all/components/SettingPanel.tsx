import { Select, Switch } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { localeOptions } from '@src/lib/i18n/localeOptions';
import type { Locale } from '@src/lib/i18n';

export const SettingPanel = ({ children }: { children: React.ReactNode }) => {
  const { locale, changeLocale, t } = useI18n();

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
        <Select variant="borderless" value={locale} options={localeOptions} onChange={handleLanguageChange} />
      </div>
      <div className="mb-2 h-[1px] bg-[#eee]"></div>
      <div className="mb-2">{t.settings.pluginPermissions}</div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold">X</div>
        <Switch disabled></Switch>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold">Binance</div>
        <Switch disabled></Switch>
      </div>
      <div className="flex items-center justify-between">
        <div className="font-bold">OKX</div>
        <Switch disabled></Switch>
      </div>
    </div>
  );
};
