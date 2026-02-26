# Content Script 隔离世界详解

## Chrome 扩展的 Content Script 隔离机制

### 什么是"隔离世界"（Isolated Worlds）？

Chrome 扩展的 Content Scripts 运行在所谓的"隔离世界"中，这是 Chrome 的安全机制：

```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器标签页                              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        页面主上下文 (Main World)                      │  │
│  │  - 页面自己的 JavaScript 代码                          │  │
│  │  - MetaMask 注入的 window.ethereum                    │  │
│  │  - 网站的所有 JavaScript 变量和函数                    │  │
│  │  - 可以访问 DOM                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↕ DOM 操作                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        Content Script 隔离世界 (Isolated World)        │  │
│  │  - 扩展的 Content Script 代码                          │  │
│  │  - 有自己的 window 对象（但与主世界不同）              │  │
│  │  - window.ethereum = undefined ❌                     │  │
│  │  - 可以访问 DOM（与主世界共享 DOM）                    │  │
│  │  - 不能访问主世界的 JavaScript 变量                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 为什么 `window.ethereum` 在 Content Script 中是 undefined？

1. **MetaMask 注入到主世界**
   - MetaMask 作为浏览器扩展，将 `window.ethereum` 注入到**页面主上下文**
   - 这是出于安全考虑：只有页面的 JavaScript（主世界）能直接访问钱包

2. **Content Script 有自己的 window**
   - Content Script 运行在隔离世界，有自己独立的 `window` 对象
   - 这个 `window` 对象是浏览器为隔离世界创建的沙箱副本
   - 虽然看起来像 `window`，但实际上与主世界的 `window` 不同

3. **验证隔离**
   ```javascript
   // 在 Content Script 中运行
   console.log(window.ethereum); // undefined ❌
   console.log(typeof window.ethereum); // "undefined"

   // 即使主世界有 ethereum，Content Script 也看不到
   ```

### 隔离世界的特点

✅ **共享的内容**：
- DOM（可以访问和修改页面元素）
- CSS（可以读取和修改样式）
- DOM 事件（可以监听和触发事件）

❌ **不共享的内容**：
- JavaScript 变量（主世界的变量 Content Script 看不到）
- JavaScript 函数（主世界的函数 Content Script 调用不了）
- window 上的属性（除了标准 DOM API）
- localStorage、sessionStorage（各自独立）

## 解决方案对比

### 方案 1：脚本注入（当前方案）✅ 推荐

```typescript
// 在 Content Script 中
const executeInPageContext = (code: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.textContent = `
      // 这段代码在主世界执行！
      (function() {
        const result = window.ethereum.request({ method: 'eth_requestAccounts' });
        window.postMessage({ type: 'RESULT', data: result }, '*');
      })();
    `;
    document.head.appendChild(script);
    // 监听返回结果...
  });
};
```

**优点**：
- ✅ 可以访问主世界的 `window.ethereum`
- ✅ 简单可靠
- ✅ 无需额外权限
- ✅ 兼容性好

**缺点**：
- ❌ 不能返回 Promise（只能通过 postMessage 通信）
- ❌ 需要手动处理消息传递
- ❌ 代码稍微复杂

### 方案 2：直接注入 <script> 标签并回调

```typescript
const checkWallet = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // 创建一个唯一的回调名
    const callbackName = 'walletCheckCallback_' + Date.now();

    // 在 window 上设置回调
    (window as any)[callbackName] = (hasWallet: boolean) => {
      resolve(hasWallet);
      delete (window as any)[callbackName];
      script.remove();
    };

    // 注入脚本
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const hasWallet = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
        // 调用 Content Script 设置的回调
        window.${callbackName}(hasWallet);
      })();
    `;
    document.head.appendChild(script);
  });
};
```

**优点**：
- ✅ 比方案 1 更简单
- ✅ 通过 window 上的回调函数通信
- ✅ 可以同步返回结果

**缺点**：
- ❌ 污染全局 window（临时）
- ❌ 需要清理回调函数
- ❌ 对 Promise 支持不够好

### 方案 3：使用 CustomEvent 通信

```typescript
const checkWallet = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // 监听自定义事件
    document.addEventListener('WALLET_CHECK_RESULT', function handler(e: any) {
      resolve(e.detail.hasWallet);
      document.removeEventListener('WALLET_CHECK_RESULT', handler);
      script.remove();
    });

    // 注入脚本
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const hasWallet = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
        document.dispatchEvent(new CustomEvent('WALLET_CHECK_RESULT', {
          detail: { hasWallet }
        }));
      })();
    `;
    document.head.appendChild(script);
  });
};
```

**优点**：
- ✅ 更符合 DOM 事件规范
- ✅ 不污染 window
- ✅ 可以传递复杂数据

**缺点**：
- ❌ 需要事件监听
- ❌ 仍然需要异步处理

### 方案 4：完全绕过 Content Script（不推荐）

在 `manifest.json` 中设置：
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "all_frames": true
    }
  ]
}
```

但这**不会**解决问题，因为 Content Script 始终运行在隔离世界。

### 方案 5：使用 Programmatic Injection（编程式注入）❌ 不可行

```typescript
// 在 Background Script 中
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    // 这段代码在主世界执行
    return window.ethereum.request({ method: 'eth_requestAccounts' });
  }
});
```

**问题**：
- ❌ 需要 Background Script 中转
- ❌ 需要 sender.tab（在 IFRAME 中不可用）
- ❌ 通信复杂

### 方案 6：World ID "MAIN" ❌ 不可用（已废弃）

Manifest V3 曾支持指定脚本在主世界运行：
```json
{
  "content_scripts": [
    {
      "world": "MAIN", // ❌ 这个特性已被移除
      "js": ["content.js"]
    }
  ]
}
```

Chrome 移除了这个特性因为安全原因。

## 为什么 Login.tsx 中直接访问 window.ethereum 不行？

```typescript
export const Login = ({ onLoginSuccess, onConnect, isConnecting = false, connectionError = null }: LoginProps) => {
  const handleConnect = async () => {
    console.log('[Login] Connect button clicked', window.ethereum); // undefined ❌
    const data = await window.ethereum.request('eth_requestAccounts'); // Error ❌
  };
};
```

**原因**：
1. Login.tsx 是 Content Script 的一部分
2. Content Script 运行在隔离世界
3. `window.ethereum` 在隔离世界中不存在

## 正确的做法

### 方案 A：调用父组件提供的函数（当前推荐）

```typescript
// Login.tsx
export const Login = ({ onConnect }: LoginProps) => {
  const handleConnect = async () => {
    // 不要直接访问 window.ethereum
    // 调用父组件提供的 onConnect 函数
    if (onConnect) {
      await onConnect();
    }
  };
};

// App.tsx
const handleConnectWallet = async () => {
  // 使用脚本注入访问主世界的 window.ethereum
  const address = await connectPageContextWallet();
};
```

### 方案 B：直接在 Login.tsx 中注入脚本

创建一个共享的工具函数文件：

```typescript
// src/lib/walletUtils.ts
export const checkWallet = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.textContent = `
      window.__WALLET_CHECK_RESULT__ = typeof window.ethereum !== 'undefined';
    `;
    document.head.appendChild(script);
    script.onload = () => {
      const result = (window as any).__WALLET_CHECK_RESULT__;
      script.remove();
      resolve(result);
    };
  });
};

export const connectWallet = async (): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.textContent = `
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
          window.__WALLET_ACCOUNTS__ = accounts;
          window.dispatchEvent(new Event('wallet-connect-success'));
        })
        .catch(err => {
          window.__WALLET_ERROR__ = err.message;
          window.dispatchEvent(new Event('wallet-connect-error'));
        });
    `;
    document.head.appendChild(script);

    window.addEventListener('wallet-connect-success', () => {
      const accounts = (window as any).__WALLET_ACCOUNTS__;
      script.remove();
      resolve(accounts);
    });

    window.addEventListener('wallet-connect-error', () => {
      const error = (window as any).__WALLET_ERROR__;
      script.remove();
      reject(new Error(error));
    });
  });
};
```

然后在 Login.tsx 中使用：

```typescript
import { checkWallet, connectWallet } from '@/lib/walletUtils';

export const Login = ({ onLoginSuccess }) => {
  const handleConnect = async () => {
    // 使用工具函数注入脚本
    const hasWallet = await checkWallet();
    if (!hasWallet) {
      alert('请安装 MetaMask');
      return;
    }

    const accounts = await connectWallet();
    onLoginSuccess(accounts[0]);
  };
};
```

## 总结

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 脚本注入 + postMessage | 可靠、标准 | 异步处理复杂 | ⭐⭐⭐⭐⭐ |
| 脚本注入 + window 回调 | 简单直接 | 污染全局 | ⭐⭐⭐⭐ |
| 脚本注入 + CustomEvent | 符合 DOM 规范 | 需要事件监听 | ⭐⭐⭐⭐ |
| Background Script 中转 | 架构清晰 | 需要 tab 上下文 | ⭐⭐⭐ |
| 直接访问 window.ethereum | 最简单 | **在隔离世界中不可行** | ❌ |

**关键点**：
- Content Script 运行在隔离世界，无法直接访问主世界的 `window.ethereum`
- 必须通过脚本注入到主世界才能访问
- 当前项目已实现的方案（executeInPageContext）是正确的做法
