# CSP 问题解决方案：使用 Blob URL

## 问题

使用 `script.textContent` 注入内联脚本违反 CSP：

```javascript
// ❌ 违反 CSP
const script = document.createElement('script');
script.textContent = 'console.log("hello")'; // 内联脚本
document.head.appendChild(script);
```

错误信息：
```
Executing inline script violates the following Content Security Policy directive
'script-src 'self' 'wasm-unsafe-eval' ...'
```

## 解决方案：使用 Blob URL

### 为什么 Blob URL 可以工作？

CSP 的 `script-src 'self'` 指令限制的是：
- ❌ 内联脚本（`script.textContent`）
- ❌ 内联事件处理器（`onclick="..."`）
- ❌ `javascript:` URL
- ✅ **外部脚本文件**（包括 Blob URL）

Blob URL 被视为"外部资源"，因为：
1. 它有一个 URL（`blob:https://example.com/uuid`）
2. 浏览器将其视为从 URL 加载的脚本
3. CSP 认为这是从 `'self'` 加载的合法资源

### 代码实现

```javascript
// ✅ 使用 Blob URL（CSP 合规）
const bridgeScriptCode = `
  (function() {
    console.log('Running in page context');
    // 可以访问 window.ethereum
  })();
`;

// 创建 Blob
const blob = new Blob([bridgeScriptCode], { type: 'text/javascript' });

// 创建 Blob URL
const blobUrl = URL.createObjectURL(blob);
// blob:https://x.com/9e5e8d00-c123-4567-89ab-cdef01234567

// 使用 src 属性（不是 textContent）
const script = document.createElement('script');
script.src = blobUrl; // ✅ 外部脚本

// 等待加载
script.onload = () => {
  URL.revokeObjectURL(blobUrl); // 清理
};

document.head.appendChild(script);
```

### 对比

| 方法 | 代码 | CSP 兼容 |
|------|------|---------|
| textContent | `script.textContent = 'code'` | ❌ 违反 CSP |
| Blob URL | `script.src = URL.createObjectURL(blob)` | ✅ CSP 合规 |
| 外部文件 | `script.src = 'file.js'` | ✅ CSP 合规 |

### Blob URL 的其他优点

1. **无需 Background Script**
   - 不需要通过 Background Script 中转
   - Content Script 直接注入脚本

2. **动态内容**
   - 可以动态生成脚本内容
   - 不需要预先创建文件

3. **内存管理**
   - 使用后可以 `URL.revokeObjectURL()` 清理
   - 不会留下持久文件

4. **安全性**
   - Blob URL 只在当前页面有效
   - 无法被其他网站访问
   - 页面关闭后自动失效

### 完整流程

```
1. Content Script 创建 Blob URL
   ↓
2. <script src="blob:..."> 添加到 DOM
   ↓
3. 浏览器从 Blob URL 加载脚本
   ↓
4. 脚本在页面主上下文执行
   ↓
5. 脚本可以访问 window.ethereum ✅
   ↓
6. 通过 postMessage 与 Content Script 通信
```

### 为什么不使用其他方法？

#### Data URL

```javascript
// ❌ 也违反 CSP
script.src = 'data:text/javascript;base64,Y29uc29sZS5sb2coJ2hpJyk=';
```

Data URL 也被视为内联内容，违反 CSP。

#### Dynamic Import

```javascript
// ❌ 也违反 CSP
import('data:text/javascript,...');
```

同样的问题。

#### eval / Function

```javascript
// ❌ 违反 CSP
eval('console.log("hello")');
new Function('console.log("hello")');
```

违反 `script-src 'self'` 和 `'unsafe-eval'` 未设置。

### 最佳实践

```typescript
export async function injectScript(code: string): Promise<void> {
  // 1. 创建 Blob
  const blob = new Blob([code], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  // 2. 创建 script 元素
  const script = document.createElement('script');
  script.src = blobUrl;

  // 3. 等待加载
  await new Promise<void>((resolve, reject) => {
    script.onload = () => {
      URL.revokeObjectURL(blobUrl); // 清理
      resolve();
    };
    script.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Script load failed'));
    };
    document.head.appendChild(script);
  });

  // 4. 等待执行
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 性能考虑

- **创建 Blob**：<1ms
- **创建 URL**：<1ms
- **加载脚本**：~10-50ms
- **总体延迟**：~50-100ms

比 Background Script 方案更快（不需要跨进程通信）。

### 浏览器兼容性

| 浏览器 | Blob URL 支持 |
|--------|--------------|
| Chrome | ✅ 20+ |
| Firefox | ✅ 13+ |
| Safari | ✅ 6+ |
| Edge | ✅ 所有版本 |

### 安全注意事项

1. **清理 URL**
   ```javascript
   URL.revokeObjectURL(blobUrl); // 使用后立即清理
   ```

2. **验证来源**
   ```javascript
   window.addEventListener('message', (event) => {
     if (event.source !== window) return; // 只接受来自同一窗口的消息
   });
   ```

3. **避免 XSS**
   - 不要将用户输入直接放入脚本代码
   - 使用 JSON.stringify 转义数据

## 总结

使用 Blob URL 是在 CSP 限制下动态注入脚本的最佳方案：

- ✅ 绕过 CSP 限制
- ✅ 不需要 Background Script
- ✅ 性能优秀
- ✅ 代码简洁
- ✅ 浏览器兼容性好
- ✅ 安全可控

这就是为什么我们的以太坊桥接方案使用 Blob URL 而不是 textContent。
