import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getEntitlement, type GuardEntitlement } from '@src/api/guard';
import { logout } from './userSlice';

type GuardState = {
  /** 权益信息，null 表示尚未获取或已登出 */
  entitlement: GuardEntitlement | null;
  entitlementLoading: boolean;
  /** 后端推送是否可用；false 表示 vapid 接口返回 6130（推送未启用） */
  pushSupported: boolean;
};

const initialState: GuardState = {
  entitlement: null,
  entitlementLoading: false,
  pushSupported: true,
};

/** 推送未启用错误码：6130（HTTP 503），属静默降级，不提示用户 */
export const PUSH_DISABLED_CODE = 6130;

export const isPushDisabledError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === PUSH_DISABLED_CODE;

/**
 * 拉取权益信息。
 *
 * 失败时**必须 reject**，不能吞成 null 返回。
 *
 * 原先 catch { return null } 会把所有错误伪装成「成功但无数据」，而 fulfilled
 * reducer 又只在 payload 非空时才赋值 —— 于是请求失败时界面会一直显示上一次的
 * 数据。换账号场景下这意味着「新账号拉取失败 → 继续显示上一个账号的试用期和
 * 关注位」，用户看到的是别人的权益，且无从察觉。
 *
 * 让失败走 rejected，由 reducer 清空为 null（显示空态而非错误数据）。
 */
export const refreshGuardEntitlement = createAsyncThunk<GuardEntitlement | null, void>(
  'guard/refreshEntitlement',
  async () => {
    const res = await getEntitlement();
    return res.data ?? null;
  },
);

const guardSlice = createSlice({
  name: 'guard',
  initialState,
  reducers: {
    setEntitlement: (state, action: PayloadAction<GuardEntitlement | null>) => {
      state.entitlement = action.payload;
    },
    setPushSupported: (state, action: PayloadAction<boolean>) => {
      state.pushSupported = action.payload;
    },
    resetGuardState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(refreshGuardEntitlement.pending, state => {
        state.entitlementLoading = true;
      })
      .addCase(refreshGuardEntitlement.fulfilled, (state, action) => {
        state.entitlementLoading = false;
        state.entitlement = action.payload;
      })
      .addCase(refreshGuardEntitlement.rejected, state => {
        state.entitlementLoading = false;
        // 请求失败：清空而非保留。保留会让换账号后继续展示上一个账号的权益。
        state.entitlement = null;
      })
      .addCase(logout, () => initialState);
  },
});

export const { setEntitlement, setPushSupported, resetGuardState } = guardSlice.actions;

type GuardRootSlice = { guard: GuardState };

export const selectEntitlement = (state: GuardRootSlice): GuardEntitlement | null => state.guard.entitlement;
export const selectPushSupported = (state: GuardRootSlice): boolean => state.guard.pushSupported;

/**
 * 静音中：muted_until 非空且晚于当前时刻。
 * 长期静音与横幅的 24h 临时静音共用这一个字段，仅时长不同。
 */
export const getMutedUntil = (entitlement: GuardEntitlement | null): string | null => {
  if (!entitlement?.muted_until) return null;
  return new Date(entitlement.muted_until).getTime() > Date.now() ? entitlement.muted_until : null;
};

export const selectMutedUntil = (state: GuardRootSlice): string | null => getMutedUntil(state.guard.entitlement);

export const selectIsPushMuted = (state: GuardRootSlice): boolean => selectMutedUntil(state) !== null;

/**
 * 推送资格 = 权益生效中(trial_active/paid_active) 且 未静音。
 * 注意：上限一律取 watchlist_max_tokens，禁止前端写死。
 */
export const selectCanReceivePush = (state: GuardRootSlice): boolean => {
  const entitlement = state.guard.entitlement;
  if (!entitlement) return false;
  const active = entitlement.status === 'trial_active' || entitlement.status === 'paid_active';
  return active && !selectIsPushMuted(state);
};

export default guardSlice.reducer;
