# MetaMask 注入时机问题 - 解决方案

## 🔍 问题诊断

### 现象

1. **用户在控制台输入** `window.ethereum` - **有值** ✅
   ```javascript
   Proxy(d) {_events: {…}, _eventsCount: 0, _maxListeners: 100, ...}
   ```

2. **Background Script 执行时检查** `typeof window.ethereum` - **undefined** ❌
   ```
   [Page Context] typeof window.ethereum: undefined
   ```

### 根本原因

**MetaMask 注入的时机问题！**

```
时间线：
0ms   - Content Script 加载
100ms - Background Script 尝试检查 window.ethereum
       ↓ (此时 MetaMask 还未注入)
500ms - MetaMask 开始注入
1000ms - MetaMask 注入完成
       ↓ (此时 window.ethereum 可用)
```

**问题**：我们的代码执行太早了！

## ✅ 解决方案：重试机制

### 实现逻辑

```typescript
// 最多重试 10 次，每次间隔 500ms
const maxRetries = 10;
const retryDelay = 500;

for (let attempt = 0; attempt < maxRetries; attempt++) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (typeof window.ethereum === 'undefined') {
        if (attempt < maxRetries - 1) {
          return { retry: true }; // 需要重试
        }
        throw new Error('Not found');
      }
      // 执行实际代码...
    }
  });

  if (result.retry) {
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    continue; // 重试
  }

  return result;
}
```

### 执行流程

```
尝试 1 (0ms)
  ↓ window.ethereum = undefined
  ↓ 等待 500ms
尝试 2 (500ms)
  ↓ window.ethereum = undefined
  ↓ 等待 500ms
尝试 3 (1000ms)
  ↓ window.ethereum = Proxy {...} ✅
  ↓ 成功！
```

## 🧪 测试步骤

1. **重新构建扩展**：
   ```bash
   pnpm build
   ```

2. **重新加载扩展**：
   - 打开 `chrome://extensions/`
   - 点击扩展的"重新加载"按钮

3. **刷新 x.com 页面**

4. **点击 "Connect Wallet"**

5. **观察控制台日志**：
   ```
   [Background] Attempt 1/10
   [Page Context] Attempt 1/10
   [Page Context] typeof window.ethereum: undefined
   [Background] Retrying in 500ms...

   [Background] Attempt 2/10
   [Page Context] Attempt 2/10
   [Page Context] typeof window.ethereum: undefined
   [Background] Waiting 500ms before retry...

   [Background] Attempt 3/10
   [Page Context] Attempt 3/10
   [Page Context] typeof window.ethereum: object
   [Page Context] Ethereum provider found! isMetaMask: true
   [Background] Result: { success: true, result: true }
   [App] Wallet detected: true
   ```

## 📊 性能影响

| 场景 | 延迟 | 说明 |
|------|------|------|
| MetaMask 已注入 | ~50ms | 第 1 次尝试成功 |
| MetaMask 注入中 | ~1000ms | 第 2-3 次尝试成功 |
| MetaMask 未安装 | ~5000ms | 10 次重试后失败 |

**用户感知**：连接过程会稍微延迟（最多 5 秒），但最终会成功。

## 🎯 为什么会出现这个问题？

### MetaMask 注入机制

MetaMask 使用 **content script** 向页面注入 `window.ethereum`：

1. 页面加载
2. MetaMask 的 content script 执行
3. 注入 `window.ethereum` 对象
4. 设置事件监听器

**这个过程是异步的**，需要时间！

### 为什么控制台能看到？

当你打开开发者工具时：
1. 可能已经过了几秒钟
2. MetaMask 已经完成注入
3. 所以 `window.ethereum` 存在

但是我们的代码在页面加载后立即执行，可能太早了！

## 🔧 其他可能的解决方案

### 方案 1：延长初始延迟

```typescript
// Content Script 加载后等待 2 秒再检查
setTimeout(async () => {
  const hasWallet = await checkPageContextWallet();
}, 2000);
```

**缺点**：固定延迟不够灵活

### 方案 2：监听 DOM 加载完成

```typescript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

**缺点**：DOMContentLoaded 不保证 MetaMask 已注入

### 方案 3：监听 window.ethereum 变化（使用 Proxy）

```typescript
let ethereumDetected = false;
Object.defineProperty(window, 'ethereum', {
  get() {
    ethereumDetected = true;
    return this._ethereum;
  },
  set(value) {
    ethereumDetected = true;
    this._ethereum = value;
  }
});
```

**缺点**：需要在页面加载时立即执行

### ✅ 方案 4：重试机制（当前方案）

**优点**：
- ✅ 适应不同注入时机
- ✅ 最大等待时间可控
- ✅ 成功后立即返回
- ✅ 实现简单可靠

## 📝 最佳实践建议

1. **给用户反馈**
   ```typescript
   const [isWaiting, setIsWaiting] = useState(false);

   const handleConnect = async () => {
     setIsWaiting(true);
     await connectPageContextWallet();
     setIsWaiting(false);
   };

   // UI 显示"正在检测钱包..."
   {isWaiting && <div>正在检测 MetaMask，请稍候...</div>}
   ```

2. **显示进度**
   ```typescript
   // UI 显示重试进度
   正在连接... (2/10)
   ```

3. **超时提示**
   ```typescript
   if (attempt >= maxRetries) {
     alert('未检测到 MetaMask，请确保：\n1. 已安装 MetaMask\n2. 已解锁 MetaMask\n3. 刷新页面后重试');
   }
   ```

4. **手动重试**
   ```typescript
   <button onClick={handleRetry}>重新检测</button>
   ```

## 🎉 总结

通过添加重试机制，我们解决了 MetaMask 注入时机问题：

- ✅ 自动等待 MetaMask 注入
- ✅ 最多等待 5 秒（10 次 × 500ms）
- ✅ 成功后立即返回
- ✅ 失败后给出明确提示

现在应该可以成功检测到 MetaMask 了！
