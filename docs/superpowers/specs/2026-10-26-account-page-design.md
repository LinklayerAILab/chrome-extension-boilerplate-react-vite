# 个人中心页面（My Account）设计

日期：2026-10-26
状态：待实现

## 背景与意图

当前「个人中心」是点击侧边栏头像后弹出的 `Popover` + `LoginPanel`（`App.tsx:1199-1219`）。弹层宽度仅 370px、信息挤在浮层里，且设计稿（Figma `12127-11068`）要求把它升级为一个完整的页面，容纳积分、地址、关注位、试用倒计时、邀请、LLAx 领取与订阅入口。

目标：把这些内容整合成一个独立页面，视觉对齐设计稿，交互上从「浮层」变为「页面」。

## 目标

- 点击头像进入独立的「My Account」页面，不再弹浮层
- 页面信息层级与设计稿一致：绿色头部 → 账户卡片（四行数据 + 头像 + Log out）→ 邀请 & LLAx → About Points
- 复用现有数据源与业务流程，不重复实现退出登录、LLAx 领取、支付

## 非目标

- 不改动现有 Points 页的购买流程（Subscribe 只做跳转）
- 不新增后端接口
- 不改动 SettingPanel（语言/通知/插件权限仍走原入口）
- 不做头像上传功能（仅展示后端返回的 `image`）

## 已确认的决策

以下均由用户确认：

| 决策点 | 结论 |
|---|---|
| LoginPanel 去留 | **直接把 `LoginPanel` 改造成页面组件**，不保留旧弹层 |
| 结构顺序 | 绿色头 → 账户卡片 → 邀请人数 → LLAx + Claim → About Points |
| 邮箱 | **不展示**（从页面中移除） |
| 旧区块样式 | 邀请人数、LLAx+Claim 搬过来时**保持现有视觉**，不重新设计 |
| Free Ends 倒计时 | 基于 `remaining_seconds` **每秒实时递减**，格式 `HH:MM:SS` |
| Subscribe | 点击**跳转 Points 页**（`setSelectedMenuId(6)`） |
| 头像 | 取自后端 `/v1/get_userinfo` 的 `image` 字段（完整 URL） |

## 页面结构

内容区宽度 450px（`PageLayout` 内 482px − 左右各 16px）。

| # | 区块 | 数据源 | 样式来源 |
|---|---|---|---|
| 1 | 绿色头部：`My Account` + 副标题 + 硬币插画 | i18n `pageInfo.account` | 设计稿；复用 `PageLayout` 的 140px `#cf0` 头 + `AlphaBg` |
| 2 | 账户卡片外框 | — | 设计稿：白底 + 黑边框 + 圆角 |
| 3 | 头像（圆形）+ `Log out` 按钮 | `state.user.otherInfo.image` | 设计稿 |
| 4 | My Points · 数值 | `state.user.points` | 设计稿：内嵌带边框子卡片 |
| 5 | EVM Address · 数值 | `state.user.address`（`formatAddress`） | 同上 |
| 6 | Watch Quota · 当前/上限 | `entitlement.watchlist_current` / `watchlist_max_tokens` | 同上 |
| 7 | Free Ends · 倒计时 | `entitlement.remaining_seconds` | 同上 |
| 8 | 邀请人数 | `otherInfo.invite_count` | **旧样式原样** |
| 9 | LLAx 余额 + Claim | `get_llax_balance()` + `executeClaimFlow` | **旧样式原样** |
| 10 | About Points：说明 + Subscribe + 权益列表 | i18n | 设计稿：浅黄绿底、灰分隔条 |

### About Points 区块细节

- 标题 `About Points`
- 说明文案：`Log in to enjoy free perks, and purchase points for more benefits.`
- `Subscribe` 按钮：白底黑边框 + 硬阴影，点击 → `dispatch(setSelectedMenuId(6))`
- 灰色分隔条：`Benefits include:`
- 权益列表（5 条，静态文案）：
  - `BEP20 coin picks — free forever`
  - `Piloter starter quota — free for a limited time`
  - `$9.90 — includes 1 month of full Piloter access`
  - `$29.90 — includes 3 months of full Piloter access`
  - `$99.90 — includes 12 months of full Piloter access`

价格与现有 `STRIPE_PACKAGES`（basic 9.9 / standard 29.9 / professional 99.9）一致；此处仅作说明，不可点击。

## 技术方案

### 1. 页面注册

项目无 router，靠 `uiSlice.selectedMenuId` + `App.tsx` 的 `renderContent()` 条件渲染。

新增页面 id `8`，需同步改动：

- `App.tsx:69-77` `pageKeyMap` 加 `8: 'account'`（并扩展其类型联合）
- `App.tsx:1042-1092` `renderContent()` 加 `{selectedMenuId === 8 && <AccountPage … />}`
- `App.tsx:1055-1063` `iconMap` 加 `8: getLogo('alpha/…')`（资源见「待定」）
- `store/slices/pageInfoSlice.ts` 的 `PageInfoState`、`defaultInitialState`、`getTranslatedInitialState` 各加 `account`
- `lib/i18n/types.ts` 的 `pageInfo` 类型 + 5 个 locale 的 `pageInfo.account`
  - 注意：`types.ts` 目前连 `token` 都缺，需一并补齐，否则新增 key 会报类型错

默认 id 7（`uiSlice.ts:12`）不变，仅在点击头像时切到 8。

### 2. 入口改造

`App.tsx:1199-1219`：把 `<Popover content={<LoginPanel …/>}>` 整块替换为可点击 div：

```tsx
<div
  className="…cursor-pointer rounded-full…"
  onClick={() => dispatch(setSelectedMenuId(8))}>
  {otherInfo.image ? <img src={otherInfo.image} …/> : null}
</div>
```

同时删除只为弹层服务的 `handlePopoverOpenChange`（`App.tsx:1000-1041`）——其刷新逻辑移入新页面的挂载 effect。

### 3. LoginPanel → AccountPage

**改造而非新建**，保留其已有能力：

保留：
- `handleLogout` 的调用（由 `App.tsx` 以 prop 传入，与 `Points` 传 wallet props 的既有模式一致）
- LLAx 余额加载、Claim 流程（`LoginPanel.tsx:87-243`）——**改为调用 `lib/claimLlax.ts` 的 `executeClaimFlow`**，删掉重复实现
- 用户信息刷新 effect（`LoginPanel.tsx:246-265`）
- 邀请人数卡片

新增：
- 绿色头部（由 `PageLayout` 提供，页面只负责产出内容）
- 账户卡片四行数据（含 Free Ends 倒计时）
- About Points 区块

删除：
- 邮箱行
- 头像两侧的品牌小图标（`icon.svg` / `iconRounded.svg`，设计稿无）
- 底部 `music.svg` 装饰图（设计稿无）
- `Popover` 专用的 `w-[370px]` 固定宽度

### 4. Free Ends 倒计时

```ts
// 以 entitlement.remaining_seconds 为起点，本地每秒递减
const [remaining, setRemaining] = useState<number>(0);
useEffect(() => {
  if (!entitlement?.remaining_seconds) return;
  setRemaining(entitlement.remaining_seconds);
  const timer = window.setInterval(() => {
    setRemaining(prev => (prev > 0 ? prev - 1 : 0));
  }, 1000);
  return () => window.clearInterval(timer);
}, [entitlement?.remaining_seconds]);

// 格式化为 HH:MM:SS（小时可超过 24）
const formatHMS = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
```

权益由 `refreshGuardEntitlement` 每 60 秒刷新（沿用 `GuardEntitlementBar` 的间隔），与本地递减并行——后端值到达时以它为基准重置。

### 5. i18n

新增 key（5 个语种）：
- `pageInfo.account.title` / `.description`
- `loginPanel` 段扩展：`myAccount`、`watchQuota`、`freeEnds`、`aboutPoints`、`aboutPointsDesc`、`benefitsInclude`、`benefit1..5`、`subscribe`

复用现有：`loginPanel.logout` / `myPoints` / `evmAddress` / `myInvite`，`guard.watchlistQuota`，`common.copy`。

## 约束

- 必须通过 `pnpm -F @extension/content-ui type-check` 且不新增错误（当前基线 128 个既有错误）
- 必须通过 `prettier --check`
- 不复用已失效代码：`InvitePanel.tsx`、`ClaimModal.tsx` 当前均未被任何组件引用，如要使用须先确认

## 已确定的资源

**绿色头部插画**：用户提供的切图已保存至 `pages/content-ui/public/account/account-banner.svg`（144×122，`#CCFF00` 硬币叠 + 盒子 + 闪光）。通过 `getLogo('account/account-banner.svg')` 引用。

## 验收

1. 点击侧边栏头像 → 进入 My Account 页面，不再弹出浮层
2. 页面自上而下为：绿色头 / 账户卡片（头像 + Log out + 4 行数据）/ 邀请 / LLAx+Claim / About Points
3. Free Ends 数字每秒递减
4. 无邮箱行
5. Log out 正常退出并回到登录态
6. Claim 按钮能完成链上领取
7. Subscribe → 跳到 Points 页
8. 切换 5 个语种，文案与布局均正常
