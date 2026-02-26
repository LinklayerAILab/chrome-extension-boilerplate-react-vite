# Content UI i18n 多语言系统

## 功能特性

- ✅ 支持 5 种语言：英语、韩语、日语、中文、俄语
- ✅ 自动检测浏览器语言
- ✅ 使用 Chrome Storage API 持久化存储用户选择
- ✅ 类型安全的 TypeScript 支持
- ✅ 简单易用的 Hook API

## 使用方法

### 1. 在组件中使用 useI18n Hook

```tsx
import { useI18n } from '@src/lib/i18n';

export const MyComponent = () => {
  const { locale, changeLocale, t } = useI18n();

  return (
    <div>
      <h1>{t.settings.title}</h1>
      <p>Current locale: {locale}</p>
      <button onClick={() => changeLocale('ko')}>한국어</button>
    </div>
  );
};
```

### 2. 添加新的翻译文本

1. 在对应的语言文件中添加翻译

```typescript
// src/lib/i18n/locales/en.ts
export const en = {
  // 现有翻译
  settings: { ... },

  // 新增翻译
  myNewFeature: {
    title: 'New Feature',
    description: 'This is a new feature',
  },
} as const;
```

2. 在所有其他语言文件中添加相同的键

```typescript
// src/lib/i18n/locales/ko.ts
export const ko = {
  // ...
  myNewFeature: {
    title: '새 기능',
    description: '이것은 새로운 기능입니다',
  },
} as const;
```

### 3. 添加新语言

1. 创建新的语言文件

```typescript
// src/lib/i18n/locales/fr.ts
export const fr = {
  settings: {
    title: 'Paramètres',
    language: 'Langue',
    pluginPermissions: 'Permissions du plugin',
  },
  languages: {
    en: 'English',
    ko: '한국어',
    ja: '日本語',
    zh: '中文',
    ru: 'Русский',
    fr: 'Français',
  },
} as const;
```

2. 更新 index.ts

```typescript
// src/lib/i18n/index.ts
import { fr } from './locales/fr';

export type Locale = 'en' | 'ko' | 'ja' | 'zh' | 'ru' | 'fr';

export const locales = {
  en, ko, ja, zh, ru, fr,
} as const;
```

3. 更新 localeOptions

```typescript
// src/lib/i18n/localeOptions.tsx
export const localeOptions: SelectOption[] = [
  // ...existing options
  { label: 'Français', value: 'fr' },
] as const;
```

## API 文档

### useI18n()

返回值：

- `locale: Locale` - 当前语言代码
- `changeLocale: (locale: Locale) => void` - 切换语言函数
- `t: LocaleMessages` - 翻译对象

### 存储机制

- 使用 `chrome.storage.local` 存储用户选择
- 存储键: `content-ui-locale`
- 组件挂载时自动读取保存的语言设置

## 语言列表

| 代码 | 语言 |
|------|------|
| `en` | English |
| `ko` | 한국어 (韩语) |
| `ja` | 日本語 (日语) |
| `zh` | 中文 (简体中文) |
| `ru` | Русский (俄语) |

## 注意事项

1. 所有语言文件必须保持相同的键结构
2. 使用 `as const` 确保类型安全
3. 翻译文本会自动根据浏览器语言和用户设置加载
4. 修改语言文件后需要重新编译
