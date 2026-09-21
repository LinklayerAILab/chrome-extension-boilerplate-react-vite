/**
 * 401 会话清理
 * 统一处理未授权(登录过期)时的本地状态清理：
 * - 清空 localStorage 中的 token/address/otherInfo/invite_code
 * - 重置 redux user 状态（logout reducer 已含全部清理）
 * - 复位侧栏 UI 并广播 unauthorized 事件（App 监听后同步清除钱包状态）
 */

import { store } from '@src/store';
import { logout as logoutAction } from '@src/store/slices/userSlice';
import { setSidePanelOpen, setSelectedMenuId } from '@src/store/slices/uiSlice';
import { ACCESS_TOKEN_KEY } from './storageKeys';

export function handleUnauthorizedSession(): void {
  // 幂等守卫：并发 401（如轮询+弹层同时过期）只清理一次
  const state = store.getState() as { user: { isLogin: boolean } };
  if (!state.user.isLogin && !window.localStorage.getItem(ACCESS_TOKEN_KEY)) {
    return;
  }

  store.dispatch(logoutAction());
  store.dispatch(setSidePanelOpen(false));
  store.dispatch(setSelectedMenuId(1));
  window.dispatchEvent(new Event('unauthorized'));
}
