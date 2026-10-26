# Content Script 资源访问问题 - 图标显示修复

## 🔍 问题分析

### 原问题代码

```typescript
// ❌ 错误：使用绝对路径
import alphaIcon from '/alpha.svg';

<img src={alphaIcon} alt="Alpha" />
// 结果：src="/alpha.svg" → 在 x.com 上变成 https://x.com/alpha.svg
// 错误：x.com 服务器上没有这个文件！
```

### 为什么不工作？

```
Content Script (在 x.com 页面中运行)
  ↓
<img src="/alpha.svg" />
  ↓
浏览器查找：https://x.com/alpha.svg
  ↓
404 Not Found ❌

实际文件位置：
chrome-extension://<extension-id>/content-ui/alpha.svg ✅
```

## ✅ 解决方案：使用 `chrome.runtime.getURL()`

### 修改后的代码

```typescript
// ✅ 正确：使用 chrome.runtime.getURL()
const iconUrl = chrome.runtime.getURL(`content-ui/alpha.svg`);

<img src={iconUrl} alt="Alpha" />
// 结果：src="chrome-extension://<extension-id>/content-ui/alpha.svg" ✅
```

### 完整实现

**1. 创建图标名称常量（`lib/icons.ts`）**：

```typescript
export const ICONS = {
  ALPHA: 'alpha.svg',
  ALPHA_SELECT: 'alpha-select.svg',
  API: 'api.svg',
  // ... 其他图标
} as const;
```

**2. 在组件中使用（`Menus.tsx`）**：

```typescript
const menus = [
  {
    id: 1,
    title: 'Alpha',
    icon: ICONS.ALPHA,
    selectIcon: ICONS.ALPHA_SELECT,
  },
  // ...
];

// 渲染时动态获取 URL
<img
  src={chrome.runtime.getURL(`content-ui/${menu.icon}`)}
  alt={menu.title}
/>
```

## 📊 路径对比

| 方法 | 路径 | 是否工作 | 原因 |
|------|------|---------|------|
| `/alpha.svg` | `https://x.com/alpha.svg` | ❌ | 文件不在 x.com 服务器 |
| `./alpha.svg` | `https://x.com/alpha.svg` | ❌ | Content Script 相对于页面根目录 |
| `chrome.runtime.getURL()` | `chrome-extension://.../alpha.svg` | ✅ | 正确的扩展资源路径 |

## 🎯 关键点

### Content Script 的上下文

```
x.com 页面
├── Content Script (我们的代码在这里运行)
│   └── <img src="/alpha.svg" → 查找 https://x.com/alpha.svg ❌
│
└── 扩展资源
    └── chrome-extension://<id>/content-ui/alpha.svg ✅
```

### 为什么需要 `chrome.runtime.getURL()`？

1. **Content Script 运行在页面上下文**
   - 相对路径是相对于页面根目录（如 https://x.com/）
   - 无法直接访问扩展的文件系统

2. **扩展资源在扩展上下文中**
   - 需要使用 `chrome.runtime.getURL()` 获取完整 URL
   - 返回格式：`chrome-extension://<extension-id>/path/to/resource`

## 📁 文件结构

```
pages/content-ui/
├── public/
│   ├── alpha.svg              ← 图标文件
│   ├── alpha-select.svg
│   ├── api.svg
│   └── ...
├── src/matches/all/
│   ├── Menus.tsx              ← 使用图标的组件
│   └── lib/
│       └── icons.ts            ← 图标名称常量
```

构建后：
```
dist/
└── content-ui/
    ├── alpha.svg              ← 从 public 复制过来
    ├── alpha-select.svg
    └── ...
```

## 🚀 测试步骤

1. **重新构建扩展**：
   ```bash
   pnpm build
   ```

2. **重新加载扩展**：
   - `chrome://extensions/`
   - 点击"重新加载"

3. **刷新 x.com**

4. **检查图标**：
   - 打开扩展侧边栏
   - 连接钱包后应该看到右侧菜单图标
   - 图标应该正确显示（不是破图）

## 🔍 验证图标路径

在浏览器控制台（页面主上下文）输入：

```javascript
// 查看扩展的图标 URL
chrome.runtime.getURL('content-ui/alpha.svg')
// 应该返回类似：
// "chrome-extension://abcdefghijklmnop/content-ui/alpha.svg"
```

## 📝 其他资源文件

同样的方法适用于其他资源：

```typescript
// ✅ 正确
const imageUrl = chrome.runtime.getURL('content-ui/logo.png');
const scriptUrl = chrome.runtime.getURL('content-ui/script.js');

// ❌ 错误
const imageUrl = '/logo.png';
const scriptUrl = '/script.js';
```

## 🎉 总结

**问题**：Content Script 使用绝对路径无法访问扩展资源

**解决方案**：使用 `chrome.runtime.getURL()` 获取完整的扩展资源 URL

**关键代码**：
```typescript
const iconUrl = chrome.runtime.getURL(`content-ui/${iconName}`);
<img src={iconUrl} alt="Icon" />
```

现在图标应该可以正确显示了！
