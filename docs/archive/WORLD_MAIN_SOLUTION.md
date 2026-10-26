# 🎯 找到问题根源了！

## 问题关键

**`chrome.scripting.executeScript` 默认在隔离世界（ISOLATED）执行，而不是页面主世界（MAIN）！**

## 验证

你在 x.com 控制台看到：
```
typeof window.ethereum  // 'object' ✅（页面主世界）
```

但我们的代码在执行时看到：
```
typeof window.ethereum  // undefined ❌（隔离世界）
```

## 原因

```
页面主世界（MAIN）
  - window.ethereum = Proxy {...} ✅
  - MetaMask 注入的提供者在这里
  - 网站的 JavaScript 代码运行在这里

隔离世界（ISOLATED，默认）
  - window.ethereum = undefined ❌
  - Chrome 扩展的 executeScript 默认执行在这里
  - 无法访问页面主世界的变量
```

## ✅ 解决方案：指定 `world: 'MAIN'`

### 修改前（错误）

```typescript
chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    // 在隔离世界执行 ❌
    console.log(typeof window.ethereum); // undefined
  }
});
```

### 修改后（正确）

```typescript
chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN', // 🔑 关键！在页面主世界执行
  func: () => {
    // 在页面主世界执行 ✅
    console.log(typeof window.ethereum); // object
  }
});
```

## Chrome 扩展的两个世界

### ISOLATED World（隔离世界，默认）

- Content Scripts 默认运行在这里
- `executeScript` 默认执行在这里
- 有自己独立的 `window` 对象
- **无法访问页面主世界的 `window.ethereum`**

### MAIN World（页面主世界）

- 网站自己的 JavaScript 运行在这里
- MetaMask 在这里注入 `window.ethereum`
- 通过 `world: 'MAIN'` 可以让代码执行在这里
- **可以访问 `window.ethereum`** ✅

## Manifest V3 的变化

在 Manifest V2 中，Content Scripts 默认可以访问页面主世界的变量（虽然有某些限制）。

但在 Manifest V3 中，为了提高安全性：
- Content Scripts 完全隔离
- `executeScript` 默认在隔离世界执行
- 需要显式指定 `world: 'MAIN'` 才能访问页面主世界

## 参考

- [Chrome Extension docs - Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [World: MAIN vs ISOLATED](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Manifest V3 Content Scripts](https://developer.chrome.com/docs/extensions/mv3/intro/)

## 测试步骤

1. **重新构建**：
   ```bash
   pnpm build
   ```

2. **重新加载扩展**：
   - `chrome://extensions/`
   - 点击"重新加载"

3. **刷新 x.com**

4. **点击 "Connect Wallet"**

5. **应该看到**：
   ```
   [Page Context - MAIN WORLD] typeof window.ethereum: object ✅
   [Page Context - MAIN WORLD] Ethereum provider found! ✅
   [Page Context - MAIN WORLD] isMetaMask: true ✅
   [App] Wallet detected: true ✅
   ```

6. **MetaMask 弹出窗口** ✅

## 为什么现在能工作了？

```
Content Script
  ↓ chrome.runtime.sendMessage
Background Script
  ↓ chrome.scripting.executeScript({ world: 'MAIN' })  ← 关键！
页面主世界（MAIN）
  window.ethereum ✅ 可以访问了！
```

## 总结

**关键发现**：
- MetaMask 确实已注入 ✅
- 我们的代码在错误的世界执行 ❌
- 需要指定 `world: 'MAIN'` ✅

这就是为什么之前一直检测不到的原因！
