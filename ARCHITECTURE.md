# Chrome Extension Web3 集成架构说明

## 问题：Content Script 无法访问页面主上下文的 MetaMask

### 为什么无法访问？

1. **Content Script 隔离**
   - Content Script 运行在独立的 JavaScript 上下文
   - 无法访问页面主上下文的 `window.ethereum`

2. **CSP 限制**（Content Security Policy）
   - x.com、google.com 等网站有严格的 CSP
   - 阻止内联脚本、data URI、eval 等

### 当前的尝试方案

| 方案 | 是否可行 | 限制 |
|------|---------|------|
| 直接访问 `window.ethereum` | ❌ | Content Script 隔离 |
| `document.defaultView.ethereum` | ❌ | 仍是 Content Script 的 window |
| 内联脚本注入 | ❌ | CSP 阻止 |
| data URI 脚本 | ❌ | CSP 阻止（x.com 等） |
| Background Script 中介 | ✅ | 需要重构架构 |

---

## 推荐方案：Background Script 架构

### 架构流程

```
用户点击连接
    ↓
Content Script 发送消息
    ↓
Background Script 接收消息
    ↓
Background Script 注入到页面主上下文（通过 chrome.scripting）
    ↓
在页面主上下文调用 window.ethereum
    ↓
返回结果给 Background Script
    ↓
Background Script 发送回 Content Script
    ↓
UI 更新
```

### 实现步骤

#### 1. Background Script (background/index.ts)

```typescript
// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'WEB3_REQUEST') {
    handleWeb3Request(request, sender.tab?.id)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // 异步响应
  }
});

async function handleWeb3Request(request: any, tabId?: number) {
  if (!tabId) {
    throw new Error('No tab ID');
  }

  // 在页面主上下文执行脚本
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (method, args) => {
      // 这段代码运行在页面主上下文！
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No ethereum provider');
      }

      return window.ethereum[method](...args);
    },
    args: [request.method, request.args],
  });

  return results[0]?.result;
}
```

#### 2. Content Script (utils/detectWallet.ts)

```typescript
export async function callEthereumMethod(method: string, args?: any[]) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'WEB3_REQUEST', method, args },
      (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      }
    );
  });
}
```

#### 3. Manifest 权限

确保有 `scripting` 权限：
```json
{
  "permissions": ["scripting", "activeTab"],
  "host_permissions": ["<all_urls>"]
}
```

---

## 临时测试方案

在实现 Background Script 架构前，可以：

1. **在没有严格 CSP 的网站上测试**
   - example.com（用于开发）
   - 本地 HTML 文件
   - 自己的网站

2. **在 x.com 上的限制**
   - 无法检测 MetaMask
   - 显示"No Wallet Detected"

---

## 当前状态总结

| 网站 | CSP 严格度 | MetaMask 检测 | 连接功能 |
|------|-----------|--------------|---------|
| example.com | 宽松 | ✅ | ✅ |
| x.com | 严格 | ❌ | ❌ |
| google.com | 严格 | ❌ | ❌ |
| 本地文件 | 无 | ✅ | ✅ |

---

## 下一步行动

### 选项 1：实现 Background Script 架构（推荐）
- 重构 Web3 调用逻辑
- 使用 chrome.scripting.executeScript
- 在所有网站上都能工作

### 选项 2：接受限制
- 只在 CSP 宽松的网站上使用
- 在 x.com 上显示提示："该网站的安全策略阻止钱包连接，请在其他网站使用"

### 选项 3：使用 Popup 页面
- 不使用 Content Script UI
- 所有 Web3 操作在 Extension Popup 中进行
- Popup 有自己的上下文，可以直接访问扩展注入的内容

---

## 快速测试

1. **测试 example.com**：
   ```
   https://example.com
   ```
   应该能检测到 MetaMask

2. **测试本地文件**：
   创建 `test.html`：
   ```html
   <!DOCTYPE html>
   <html>
   <body><h1>Test Wallet</h1></body>
   </html>
   ```
   用浏览器打开

3. **检查控制台**：
   - 查看是否有 CSP 错误
   - 查看 `[Wallet]` 开头的日志

---

## 参考资料

- [Chrome Extension Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Content Security Policy](https://developer.chrome.com/docs/extensions/mv3/content_security_policy/)
- [chrome.scripting.executeScript](https://developer.chrome.com/docs/extensions/reference/scripting/#method-executeScript)
