# MetaMask 检测问题 - 诊断指南

## 🔍 问题现状

**现象**：
- Background Script 重试 10 次都检测不到 `window.ethereum`
- 用户在控制台输入 `window.ethereum` 时能看到 Proxy 对象

## 🎯 关键诊断步骤

### 步骤 1：确认控制台上下文

**重要**：当你在 x.com 页面的控制台输入 `window.ethereum` 时，**请检查控制台的上下文选择器**：

1. 打开 x.com
2. 打开开发者工具（F12）
3. 在控制台顶部找到下拉菜单
4. **必须选择 "top" 或页面主上下文**，**不能**选择 "content script" 或扩展相关的上下文

```
❌ 错误：选择了扩展的 context
✅ 正确：选择了 top（页面主上下文）
```

**验证方法**：
```javascript
// 在控制台输入
console.log('当前上下文:', window.location.href);
// 应该显示: https://x.com/...
```

### 步骤 2：在简单页面测试

1. **打开测试页面**：
   ```
   file:///D:/Job/GithubOpenSources/chrome-extension-boilerplate-react-vite/test-simple.html
   ```

2. **观察页面输出**：
   - 应该显示 "typeof window.ethereum: object" ✅
   - 如果显示 "undefined"，说明 MetaMask 确实没注入

3. **在控制台验证**：
   - 确保上下文是 "top"
   - 输入 `typeof window.ethereum`
   - 应该返回 "object"

### 步骤 3：对比测试

| 测试场景 | 预期结果 | 实际结果 | 诊断 |
|---------|---------|---------|------|
| test-simple.html | window.ethereum = object | ? | MetaMask 是否正常工作 |
| 控制台输入（top 上下文） | window.ethereum = object | ? | 是否选对了上下文 |
| 扩展在 x.com | 检测成功 | ❌ 失败 | 是否是 x.com 特有问题 |
| 扩展在 test-simple.html | ? | ? | 扩展是否正常工作 |

## 🔧 可能的原因

### 原因 1：控制台上下文错误

**症状**：在控制台看到 `window.ethereum`，但扩展检测不到

**原因**：控制台选择了 Content Script 的上下文，而不是页面主上下文

**解决**：
1. 打开控制台
2. 找到顶部的下拉菜单
3. 选择 "top"
4. 再次输入 `typeof window.ethereum`

### 原因 2：MetaMask 注入延迟

**症状**：在简单页面也检测不到

**解决**：
1. 打开 MetaMask
2. 确保 MetaMask 已解锁
3. 刷新页面
4. 等待 5-10 秒

### 原因 3：x.com 的特殊限制

**症状**：在简单页面可以，但在 x.com 不行

**x.com 可能的限制**：
- 特殊的 CSP 策略
- 阻止了 `chrome.scripting.executeScript`
- 脚本隔离机制

**验证方法**：
1. 在 x.com 控制台（top 上下文）输入：
   ```javascript
   typeof window.ethereum
   ```

2. 如果返回 "object"，说明 MetaMask 已注入
3. 但扩展还是检测不到，说明是 `executeScript` 的限制

### 原因 4：扩展权限问题

**检查 manifest.json**：
```json
{
  "permissions": [
    "scripting",
    "activeTab"
  ]
}
```

## 🎯 立即验证

### 测试 1：验证 MetaMask 真的注入了吗？

在 x.com 页面：
1. 打开控制台（F12）
2. **确保选择了 "top" 上下文**（这很关键！）
3. 输入：
   ```javascript
   typeof window.ethereum
   ```

**如果返回 "undefined"**：
- MetaMask 未注入
- 检查 MetaMask 是否解锁
- 刷新页面

**如果返回 "object"**：
- MetaMask 已注入 ✅
- 但扩展还是检测不到，继续下面的测试

### 测试 2：在简单页面测试扩展

1. 打开 `test-simple.html`
2. 打开扩展侧边栏
3. 点击 "Connect Wallet"
4. 观察控制台日志

**如果成功**：
- 扩展工作正常
- 问题出在 x.com 上
- 可能需要特殊的绕过方法

**如果失败**：
- 扩展本身有问题
- 检查 Background Script 日志

### 测试 3：手动测试 executeScript

在 x.com 的控制台（top 上下文）运行：

```javascript
// 这模拟 Background Script 做的事情
chrome.runtime.sendMessage({
  type: 'WEB3_REQUEST',
  method: 'isMetaMask',
  args: []
}, (response) => {
  console.log('[测试] Response:', response);
});
```

观察返回的结果。

## 📋 诊断清单

请按顺序检查：

- [ ] MetaMask 已安装
- [ ] MetaMask 已解锁
- [ ] 刷新了 x.com 页面
- [ ] 控制台选择了 "top" 上下文
- [ ] 在 top 上下文输入 `typeof window.ethereum` 返回 "object"
- [ ] 在 test-simple.html 上测试扩展
- [ ] 检查了 Background Script 控制台的日志
- [ ] 重新构建了扩展（`pnpm build`）
- [ ] 重新加载了扩展（chrome://extensions/）

## 💡 如果以上都确认了

如果确认：
- ✅ MetaMask 已注入到 x.com（控制台可以看到）
- ✅ 扩展在其他页面正常工作
- ❌ 只在 x.com 上失败

那么可能是 **x.com 的特殊限制**导致的 `chrome.scripting.executeScript` 无法正确访问。

**替代方案**：
1. 使用 iframe 隔离
2. 使用外部网站授权
3. 使用 MetaMask 的 dApp 连接功能

## 🚀 下一步

请提供以下信息：

1. 在 x.com 控制台（**top 上下文**）输入 `typeof window.ethereum` 的结果
2. 在 test-simple.html 测试扩展的结果
3. Background Script 的完整日志

这样我们才能确定问题的真正原因。
