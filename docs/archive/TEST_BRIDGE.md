# 快速测试指南

## 1. 重新构建扩展

```bash
cd D:\Job\GithubOpenSources\chrome-extension-boilerplate-react-vite
pnpm build
```

## 2. 重新加载扩展

1. 打开 Chrome
2. 访问 `chrome://extensions/`
3. 找到你的扩展
4. 点击"重新加载"按钮（🔄）

## 3. 测试步骤

### 方式 1：使用调试页面

1. 打开 `debug-metamask.html`
   ```
   file:///D:/Job/GithubOpenSources/chrome-extension-boilerplate-react-vite/debug-metamask.html
   ```

2. 检查控制台日志，应该看到：
   ```
   [Ethereum Bridge] Ethereum provider found: { isMetaMask: true, ... }
   ```

3. 点击"检测 MetaMask"按钮
   - 应该显示：✅ MetaMask 已安装并可用！

4. 点击"连接钱包"按钮
   - MetaMask 应该弹出批准窗口
   - 批准后显示钱包地址

### 方式 2：在 x.com 上测试

1. 打开 https://x.com
2. 等待扩展加载（应该看到右侧的侧边栏）
3. 打开浏览器控制台（F12）
4. 检查日志：
   ```
   [Ethereum Bridge] Initializing in page context...
   [Ethereum Bridge] Ethereum provider found: ...
   [Ethereum Bridge API] Initialized
   ```

5. 点击"Connect Wallet"按钮
6. MetaMask 应该弹出
7. 批准连接
8. 应该显示钱包地址

## 4. 预期的控制台日志

### 成功的情况

```
[CEB] Content ui all loaded
[Ethereum Bridge] Initializing in page context...
[Ethereum Bridge] Ethereum provider found: { isMetaMask: true, chainId: "0x1", ... }
[Ethereum Bridge] Initialized successfully
[Ethereum Bridge API] Initialized
[App] Wallet detected: { exists: true, isMetaMask: true, ... }
[Login] Connect button clicked
[Ethereum Bridge] Received request: requestAccounts
[Ethereum Bridge] Sending response: bridge_xxx [...]
[App] Wallet connected: 0x1234...
[App] Login successful
```

### 失败的情况

如果看到：
```
[Ethereum Bridge] No ethereum provider found
```

说明：
- MetaMask 未安装
- MetaMask 未解锁
- 页面还在加载中

## 5. 常见问题排查

### 问题：检测不到 MetaMask

**检查清单**：
- [ ] MetaMask 已安装？
- [ ] MetaMask 已解锁？
- [ ] 刷新了页面？
- [ ] 查看了控制台日志？

**调试步骤**：
1. 打开 `debug-metamask.html`
2. 点击"检测所有以太坊提供者"
3. 查看是否有任何提供者被检测到

### 问题：CSP 错误

**不应该出现 CSP 错误！**

如果看到 CSP 错误，说明旧代码还在运行：
- 确保重新构建了扩展
- 确保重新加载了扩展
- 清除缓存并刷新页面

### 问题：桥接脚本未初始化

**检查**：
```javascript
// 在控制台运行
window.postMessage({
  type: 'ETHEREUM_BRIDGE_REQUEST',
  action: 'check',
  id: 'test'
}, '*');

// 应该看到响应消息
```

## 6. 验证桥接方案的优势

### 对比旧方案

| 特性 | 旧方案 (Background Script) | 新方案 (桥接脚本) |
|------|--------------------------|------------------|
| 需要 Background Script | ✅ | ❌ |
| CSP 兼容 | ✅ | ✅ |
| 通信延迟 | 高（需要中转） | 低（直接通信） |
| 事件监听 | 困难 | 简单 ✅ |

### 性能对比

- 旧方案：Content Script → Background Script → Page Context (~100-200ms)
- 新方案：Content Script → Bridge Script (在页面中) (~10-50ms)

## 7. 成功标志

✅ 看到 `[Ethereum Bridge] Initialized successfully` 日志
✅ `checkWallet()` 返回 `{ exists: true, isMetaMask: true }`
✅ 点击"Connect Wallet"后 MetaMask 弹出
✅ 连接成功后显示钱包地址
✅ 没有 CSP 错误
✅ 没有 "No ethereum provider found" 错误

## 8. 下一步

如果测试成功，可以：
1. 实现更多 Web3 功能（签名、交易等）
2. 添加网络切换功能
3. 添加账户切换监听
4. 优化 UI/UX

## 9. 如果还是不行

请提供：
1. 完整的控制台日志
2. `debug-metamask.html` 的检测结果
3. Chrome 版本
4. MetaMask 版本
5. 错误截图
