# IFRAME 钱包解决方案 - 完整指南

## 🎯 方案概述

通过 IFRAME 注入扩展的钱包页面，完全绕过 Content Script 的隔离限制和 CSP 策略。

---

## ✅ 优势对比

| 特性 | Content Script | IFRAME 方案 | Background Script |
|------|---------------|------------|------------------|
| **上下文隔离** | ❌ 无法访问页面 JS | ✅ 完全独立 | ✅ 完全独立 |
| **CSP 限制** | ❌ 受宿主页面限制 | ✅ 无限制 | ✅ 无限制 |
| **MetaMask 访问** | ❌ 无法直接访问 | ✅ 直接访问 | ✅ 直接访问 |
| **实现复杂度** | 🔴 高（桥接） | 🟢 低 | 🟡 中 |
| **在 x.com 上可用** | ❌ 不可用 | ✅ 可用 | ✅ 可用 |
| **性能开销** | 低 | 低 | 中（消息传递）|
| **用户体验** | 好 | ⭐ 最好 | 好 |

---

## 📂 文件结构

```
pages/content-ui/src/
├── wallet/                          # IFRAME 钱包页面（新增）
│   ├── index.html                   # 钱包页面 HTML
│   └── App.tsx                      # 钱包页面 React 组件
├── matches/all/
│   ├── components/
│   │   ├── WalletIFrame.tsx         # IFRAME 包装组件（新增）
│   │   └── Login.tsx                # 登录组件（已更新）
│   └── App.tsx                      # 主应用（无需修改）
└── build.mts                        # 构建配置（已更新）
```

---

## 🔄 工作流程

```
用户点击"Connect Wallet"
    ↓
Login 组件设置 showWalletModal = true
    ↓
渲染 WalletIFrame 组件
    ↓
IFRAME 加载 chrome-extension://.../wallet.html
    ↓
Wallet 页面在扩展上下文中运行
    ↓
可以直接访问 window.ethereum（MetaMask）
    ↓
用户连接钱包
    ↓
Wallet 页面通过 postMessage 通知 Content Script
    ↓
Content Script 更新 UI
```

---

## 📝 关键代码

### 1. WalletIFrame 组件

```tsx
// components/WalletIFrame.tsx
<iframe
  src={chrome.runtime.getURL('content-ui/wallet.html')}
  style={{
    width: '500px',
    height: '700px',
    border: 'none',
    borderRadius: '16px',
  }}
/>
```

**关键点：**
- 使用 `chrome.runtime.getURL()` 获取扩展内的页面
- IFRAME 运行在 `chrome-extension://` 协议下
- 完全绕过宿主页面的 CSP 限制

### 2. postMessage 通信

**Wallet 页面发送：**
```typescript
// wallet/App.tsx
window.parent.postMessage(
  { type: 'WALLET_CONNECTED', data: { address: '0x...' } },
  '*'
);
```

**Content Script 接收：**
```tsx
// components/WalletIFrame.tsx
window.addEventListener('message', (event) => {
  if (event.data.type === 'WALLET_CONNECTED') {
    onConnected(event.data.data.address);
  }
});
```

### 3. Manifest 配置

```json
{
  "web_accessible_resources": [
    {
      "resources": ["content-ui/*"],
      "matches": ["*://*/*"]
    }
  ]
}
```

---

## 🧪 测试步骤

### 1. 重新加载扩展

```bash
# 如果 dev server 在运行，会自动重新构建
# 否则运行：
pnpm dev
```

在浏览器中：
1. 访问 `chrome://extensions/`
2. 点击扩展的"重新加载"按钮

### 2. 测试 x.com

1. 访问 https://x.com
2. 点击右下角"Open"按钮
3. 点击"Connect Wallet"
4. **预期结果：**
   - ✅ 弹出 IFRAME 模态框
   - ✅ 显示"连接 MetaMask"按钮
   - ✅ 点击后 MetaMask 弹出授权
   - ✅ 连接成功后显示绿色"已连接钱包"页面
   - ✅ 自动关闭模态框，侧边栏显示地址

### 3. 查看控制台日志

**宿主页面控制台：**
```
[Login] Wallet connected: 0x1234...
```

**IFRAME 控制台（右键 IFRAME → 检查）：**
```
[Wallet App] Ethereum detected: true
[Wallet App] Connecting with connector: ...
[Wallet App] Notified parent: WALLET_CONNECTED
```

---

## ⚠️ 注意事项

### 1. IFRAME 尺寸固定

当前 IFRAME 是 500px × 700px，可以根据需要调整：

```tsx
// WalletIFrame.tsx
<iframe
  style={{
    width: '500px',   // 可调整
    height: '700px',  // 可调整
  }}
/>
```

### 2. postMessage 安全性

当前使用 `'*'` 作为目标源，在生产环境中应该限制：

```tsx
// 更安全的做法
const IFRAME_ORIGIN = chrome.runtime.getURL('');

window.addEventListener('message', (event) => {
  // 验证消息来源
  if (event.origin !== IFRAME_ORIGIN) {
    return;
  }
  // ...
});
```

### 3. MetaMask 在 IFRAME 中的行为

- ✅ MetaMask **会**注入到 IFRAME
- ✅ 授权弹窗会在主窗口（不是 IFRAME 内）
- ✅ 连接状态会同步到 IFRAME

---

## 🚀 扩展功能

### 添加断开连接功能

在 Wallet 页面的"已连接"状态，已经有"断开连接"按钮：

```tsx
// wallet/App.tsx
<button onClick={handleDisconnect}>
  断开连接
</button>
```

### 添加网络切换

```tsx
import { useSwitchChain } from 'wagmi';

const { switchChain } = useSwitchChain();

<button onClick={() => switchChain({ chainId: 1 })}>
  切换到 Ethereum
</button>
```

### 添加签名交易

```tsx
import { useSignMessage, useWriteContract } from 'wagmi';

const { signMessage } = useSignMessage();

<button onClick={() => signMessage({ message: 'Hello!' })}>
  签名消息
</button>
```

---

## 🎨 UI 自定义

### 更改模态框样式

```tsx
// components/WalletIFrame.tsx
<div
  style={{
    backgroundColor: 'rgba(0, 0, 0, 0.5)',  // 遮罩颜色
    // ...
  }}
>
```

### 更改钱包页面样式

```tsx
// wallet/App.tsx
const styles = {
  container: {
    padding: '40px',
    backgroundColor: '#f9fafb',  // 背景色
    // ...
  },
};
```

---

## 📊 性能优化

### 1. 懒加载 IFRAME

只在需要时才渲染 IFRAME：

```tsx
{showWalletModal && <WalletIFrame />}
```

### 2. 连接状态持久化

将连接状态存储到 Chrome Storage：

```tsx
// 钱包连接成功后
chrome.storage.local.set({ walletAddress: address });

// 页面加载时读取
chrome.storage.local.get(['walletAddress'], (result) => {
  if (result.walletAddress) {
    // 自动连接
  }
});
```

---

## 🐛 常见问题

### Q1: IFRAME 显示空白

**原因：** wallet.html 未正确构建或未被标记为 web accessible

**解决：**
1. 检查 `dist/content-ui/wallet.html` 是否存在
2. 检查 manifest 的 `web_accessible_resources`
3. 查看控制台是否有 404 错误

### Q2: 点击连接没有反应

**原因：** MetaMask 未安装或未解锁

**解决：**
- 确保 MetaMask 已安装并解锁
- 在 IFRAME 控制台查看是否有 `window.ethereum`
- 查看是否有错误信息

### Q3: 连接成功但侧边栏没更新

**原因：** postMessage 未正确发送或接收

**解决：**
- 检查 IFRAME 控制台是否发送了消息
- 检查宿主页面控制台是否收到了消息
- 确保 `onConnected` 回调被调用

---

## 🎉 总结

IFRAME 方案是当前**最佳解决方案**：

✅ **绕过所有 CSP 限制**
✅ **在所有网站都能工作**（包括 x.com）
✅ **直接访问 MetaMask**
✅ **实现简单**
✅ **用户体验好**

现在可以在 x.com 上测试钱包连接功能了！
