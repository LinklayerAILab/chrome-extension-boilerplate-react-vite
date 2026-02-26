# CSP 错误解决方案

## 问题描述

```
Executing inline script violates the following Content Security Policy directive
'script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:* chrome-extension://...'.
```

## 错误原因

我们之前尝试使用 `script.textContent` 设置内联脚本内容：

```typescript
const script = document.createElement('script');
script.textContent = `
  (function() {
    window.ethereum.request({ method: 'eth_requestAccounts' })
  })();
`;
document.head.appendChild(script);
```

**问题**：这违反了 CSP（Content Security Policy），因为 `textContent` 是内联脚本内容。

## 解决方案：使用 Background Script

### 为什么 Background Script 方案可以工作？

1. **Content Script 有 tab 上下文**
   - Content Script 运行在网页标签页中
   - 当它发送消息给 Background Script 时，`sender.tab` 是可用的 ✅

2. **Background Script 使用 chrome.scripting.executeScript**
   - 这个 API 不会创建内联脚本
   - Chrome 会序列化函数并在页面上下文执行
   - 不违反 CSP ✅

### 架构对比

#### ❌ 旧方案：直接脚本注入（违反 CSP）

```typescript
// Content Script
const script = document.createElement('script');
script.textContent = `
  // 这段代码会触发 CSP 错误！
  window.ethereum.request({ method: 'eth_requestAccounts' })
`;
document.head.appendChild(script);
```

**问题**：
- `script.textContent` 设置的是内联脚本内容
- CSP 的 `script-src 'self'` 不允许内联脚本（除非有 `unsafe-inline`）

#### ✅ 新方案：通过 Background Script（CSP 合规）

```typescript
// Content Script
chrome.runtime.sendMessage({
  type: 'WEB3_REQUEST',
  method: 'eth_requestAccounts',
  args: [],
}, (response) => {
  console.log(response.result);
});

// Background Script
chrome.scripting.executeScript({
  target: { tabId },
  func: (methodName) => {
    // 这段代码由 Chrome 序列化并执行
    // 不涉及内联脚本字符串
    return window.ethereum.request({ method: methodName });
  },
  args: ['eth_requestAccounts'],
});
```

**优点**：
- ✅ 不创建内联脚本字符串
- ✅ Chrome 引擎直接执行序列化的函数
- ✅ 完全符合 CSP 规则

## 关键区别

| 方面 | script.textContent | chrome.scripting.executeScript |
|------|-------------------|-------------------------------|
| 代码形式 | 字符串（内联脚本） | 函数（被序列化） |
| CSP 兼容性 | ❌ 违反 `script-src` | ✅ CSP 合规 |
| sender.tab | 不需要 | 需要 ✅ |
| 使用场景 | Content Script 直接注入 | Background Script 执行 |

## 代码变化

### Content Script (App.tsx)

**之前**：
```typescript
const executeInPageContext = (code: string): Promise<any> => {
  const script = document.createElement('script');
  script.textContent = code; // ❌ CSP 错误
  document.head.appendChild(script);
};
```

**现在**：
```typescript
const executeViaBackgroundScript = async (method: string, args: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage( // ✅ 发送消息给 Background Script
      { type: 'WEB3_REQUEST', method, args },
      (response) => {
        if (response?.success) {
          resolve(response.result);
        } else {
          reject(new Error(response?.error));
        }
      }
    );
  });
};
```

### Background Script (background/index.ts)

**恢复 Web3 请求处理**：
```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'WEB3_REQUEST') {
    handleWeb3Request(request, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  return false;
});

async function handleWeb3Request(request: any, sender: chrome.runtime.MessageSender) {
  const { method, args = [] } = request;
  const tabId = sender.tab?.id; // ✅ 现在有值了！

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (methodName: string, methodArgs: any[]) => {
      // 在页面主上下文执行
      return window.ethereum[methodName](...methodArgs);
    },
    args: [method, args],
  });

  return { success: true, result: results[0].result };
}
```

## 为什么 IFRAME 方案失败了？

回顾一下历史：

1. **IFRAME + Background Script** 失败
   - wallet.html 在 IFRAME 中加载
   - IFRAME 在扩展上下文（`chrome-extension://`）
   - `sender.tab` 是 undefined ❌
   - Background Script 无法执行脚本（没有 tabId）

2. **Content Script + Background Script** 成功 ✅
   - Content Script 在网页上下文运行
   - 有真实的 tab 上下文
   - `sender.tab` 可用 ✅
   - Background Script 可以执行脚本

## 测试步骤

1. **确保扩展已重新加载**
   ```bash
   pnpm dev
   # 在 chrome://extensions/ 点击重新加载
   ```

2. **打开测试页面**
   - 访问 x.com 或任何网站
   - 打开扩展的侧边栏
   - 点击 "Connect Wallet"

3. **验证无 CSP 错误**
   - 打开浏览器控制台
   - 应该看到正常的日志，没有 CSP 错误

4. **检查 MetaMask 连接**
   - 应该弹出 MetaMask 批准窗口
   - 批准后应该显示钱包地址

## 总结

**核心教训**：
- ❌ `script.textContent = 'code'` → 违反 CSP
- ✅ `chrome.scripting.executeScript({ func: () => {...} })` → CSP 合规

**为什么这次成功了**：
- Content Script 有 tab 上下文（不像 IFRAME）
- Background Script 可以使用 `chrome.scripting.executeScript`
- 不涉及内联脚本字符串，完全符合 CSP

**下一步**：
- 测试钱包连接功能
- 实现更多 Web3 功能（签名交易、切换网络等）
