# 归档文档

本目录存放已不再维护的一次性记录。保留是为了可追溯,不是因为它们仍然准确——文中部分结论已被后续实现取代。

## 2026-02 排查记录(11 份)

这些文档记录的是 MetaMask 注入、CSP、iframe 桥接、content script 隔离等问题在项目早期的探索过程。相关方案后来大多被放弃或重写:

- `IFRAME_SOLUTION.md`、`WALLET_ARCHITECTURE.md`、`TEST_WALLET.md` —— wallet iframe 方案,已废弃(源码 `pages/content-ui/src/wallet/` 已删除)
- `BRIDGE_SOLUTION.md`、`WORLD_MAIN_SOLUTION.md`、`TEST_BRIDGE.md` —— `ethereum-bridge.js` 注入方案,已废弃(脚本与 `lib/ethereumBridge.ts` 已删除)
- `CSP_SOLUTION.md`、`BLOB_URL_CSP.md`、`CONTENT_SCRIPT_ISOLATION.md` —— CSP 与隔离世界说明,结论仍然成立,但 manifest 里的 CSP 已多处调整
- `DIAGNOSTICS.md`、`METAMASK_TIMING.md` —— 手工排查步骤,引用的绝对路径是作者本机路径
- `ICON_PATH_FIX.md`、`CONTENT_UI_WHITELIST.md` —— 图标路径与白名单说明
- `FINAL_SOLUTION.md` —— 早期"最终方案"总结,已被 `chrome-extension/src/background/index.ts` 的实际实现取代

## `manual-tests/`(7 份)

配套的手工测试页面,需在浏览器里直接打开 `file://` 使用。它们不含任何会被构建或测试引用的代码。

> 归档时未修改正文内容,因此文中的相对路径(例如指向根目录其他文件的链接)已不再指向原位置。
