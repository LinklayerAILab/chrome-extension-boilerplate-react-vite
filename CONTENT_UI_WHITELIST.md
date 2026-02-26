# Content UI 域名白名单配置

## 📋 概述

Content Script UI 只会在白名单内的域名上注入，这是一个安全特性，防止扩展在未授权的网站上运行。

## ⚙️ 配置方法

### 编辑白名单（硬编码方式）

直接编辑 `pages/content-ui/src/matches/all/App.tsx` 文件顶部的白名单配置：

```typescript
// ⚠️ 白名单配置 - 只有这些域名才会注入 Content Script UI
// 格式：精确匹配域名或通配符 *.example.com
// 多个域名用逗号分隔
// 留空则允许所有域名（仅用于开发）
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';
```

### 支持的格式

| 格式 | 说明 | 示例 | 匹配的域名 |
|------|------|------|-----------|
| 精确匹配 | 完整域名 | `x.com` | `x.com` |
| 通配符子域名 | 匹配所有子域名 | `*.example.com` | `example.com`, `www.example.com`, `api.example.com` |
| 多个域名 | 用逗号分隔 | `x.com,twitter.com` | `x.com`, `twitter.com` |

### 配置示例

```typescript
// 只允许 x.com 和 twitter.com
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';

// 允许所有 example.com 的子域名
const CONTENT_UI_WHITELIST_DOMAINS = '*.example.com';

// 允许特定域名和其所有子域名
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,*.twitter.com';

// 开发模式：允许所有域名（留空字符串）
const CONTENT_UI_WHITELIST_DOMAINS = '';
```

## 🔄 修改白名单后的操作

每次修改白名单后，必须：

1. **重新构建扩展**：
   ```bash
   pnpm build
   ```

2. **重新加载扩展**：
   - 打开 `chrome://extensions/`
   - 找到你的扩展
   - 点击"重新加载"按钮

3. **刷新测试网页**

## 🔍 检查逻辑

白名单检查在以下位置进行：

1. **主组件加载时** (`App` 组件)
   - 如果域名不在白名单内，不会创建 Shadow DOM
   - 不会渲染任何 UI 组件

2. **X.com 侧边栏植入** (`XSidebarInjection` 组件)
   - 额外检查白名单
   - 只在白名单域名内注入侧边栏元素

## 🧪 测试验证

### 1. 检查白名单状态

打开浏览器控制台，在白名单域名内应该看到：

```
[Content UI] Domain "x.com" is allowed by whitelist
[CEB] Content ui all loaded
```

在非白名单域名内应该看到：

```
[Content UI] Domain "example.com" is not in whitelist: ["x.com", "twitter.com"]
[CEB] Domain not in whitelist, skipping content script injection
```

### 2. 测试步骤

**步骤 1**：修改白名单
```typescript
// 在 App.tsx 中
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';
```

**步骤 2**：重新构建
```bash
pnpm build
```

**步骤 3**：重新加载扩展
- 打开 `chrome://extensions/`
- 点击"重新加载"按钮

**步骤 4**：测试白名单域名
- 访问 `https://x.com`
- 应该看到侧边栏 UI
- 控制台显示：`Domain "x.com" is allowed by whitelist`

**步骤 5**：测试非白名单域名
- 访问 `https://google.com`
- 不应该看到任何 UI
- 控制台显示：`Domain "google.com" is not in whitelist`

## 🔒 安全考虑

### 1. 生产环境必须配置白名单

```typescript
// ❌ 不安全：允许所有域名
const CONTENT_UI_WHITELIST_DOMAINS = '';

// ✅ 安全：只允许特定域名
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';
```

### 2. 避免过于宽泛的通配符

```typescript
// ❌ 不推荐：允许所有 .com 域名
const CONTENT_UI_WHITELIST_DOMAINS = '*.com';

// ✅ 推荐：只允许特定域名
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';
```

### 3. 定期审查白名单

- 移除不再需要的域名
- 确保每个域名都有正当理由
- 使用最小权限原则

## 📝 代码实现

白名单检查函数位于 `App.tsx` 文件顶部：

```typescript
const CONTENT_UI_WHITELIST_DOMAINS = 'x.com,twitter.com';

const isDomainWhitelisted = (): boolean => {
  const hostname = window.location.hostname;

  // 解析白名单
  const whitelist = CONTENT_UI_WHITELIST_DOMAINS
    ? CONTENT_UI_WHITELIST_DOMAINS.split(',').map((d) => d.trim())
    : [];

  // 如果白名单为空，允许所有域名（开发模式）
  if (whitelist.length === 0) {
    console.log('[Content UI] Whitelist is empty, allowing all domains');
    return true;
  }

  // 检查域名是否在白名单内
  const isAllowed = whitelist.some((whitelistDomain) => {
    // 支持通配符 *.example.com
    if (whitelistDomain.startsWith('*.')) {
      const baseDomain = whitelistDomain.slice(2);
      return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
    }
    return hostname === whitelistDomain;
  });

  if (!isAllowed) {
    console.log(`[Content UI] Domain "${hostname}" is not in whitelist:`, whitelist);
  } else {
    console.log(`[Content UI] Domain "${hostname}" is allowed by whitelist`);
  }

  return isAllowed;
};
```

## 🚀 部署清单

- [ ] 在 `App.tsx` 中配置 `CONTENT_UI_WHITELIST_DOMAINS`
- [ ] 运行 `pnpm build` 构建扩展
- [ ] 在白名单域名测试 UI 正常显示
- [ ] 在非白名单域名测试 UI 不显示
- [ ] 检查浏览器控制台确认白名单日志
- [ ] 部署到生产环境前再次审查白名单配置

## 💡 常见问题

### Q: 为什么不使用环境变量？

A: Chrome 扩展的 content script 在浏览器环境中运行，无法在构建时可靠地注入环境变量。硬编码方式更简单可靠。

### Q: 如何在开发时允许所有域名？

A: 将白名单设置为空字符串：
```typescript
const CONTENT_UI_WHITELIST_DOMAINS = '';
```

### Q: 通配符如何工作？

A: `*.example.com` 会匹配 `example.com` 及其所有子域名：
- ✅ `example.com`
- ✅ `www.example.com`
- ✅ `api.example.com`
- ❌ `another.com`

