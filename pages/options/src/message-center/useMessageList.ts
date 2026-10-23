import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageLoadError,
  fetchMessages,
  readAuth,
  type AuthInfo,
  type GuardMessage,
  type MessageFilter,
} from './api';

/** 每页条数；后端上限 100 */
const PAGE_SIZE = 20;

/**
 * 加载错误的内部标识，由 UI 层按当前语言翻译。
 * 避免在数据层硬编码中文文案——options 页语言跟随项目设置，会随用户切换。
 */
export type ListErrorKind = 'notLoggedIn' | 'sessionExpired' | 'loadFailed';

const toErrorKey = (error: unknown): ListErrorKind => {
  if (error instanceof MessageLoadError && error.kind === 'unauthorized') return 'sessionExpired';
  return 'loadFailed';
};

interface ListState {
  items: GuardMessage[];
  total: number;
  offset: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: ListErrorKind;
}

/**
 * 消息列表 + 滚动加载。
 *
 * 切换 filter 时重置列表；滚动到底部时追加下一页。
 * 用 requestGen 丢弃过期响应，避免快速切换 filter 时旧数据覆盖新结果。
 *
 * firstPageSize：首屏条数。从通知跳转进来时传更大的值（后端上限 100），
 * 确保目标消息落在首屏内、无需用户先滚动。
 */
export const useMessageList = (
  auth: AuthInfo | null,
  filter: MessageFilter,
  firstPageSize: number = PAGE_SIZE,
) => {
  const [state, setState] = useState<ListState>({
    items: [],
    total: 0,
    offset: 0,
    loading: true,
    loadingMore: false,
    hasMore: false,
  });

  /** 请求代际：切换 filter / 重新加载时自增，过期响应直接丢弃 */
  const requestGenRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    if (!auth) {
      setState({
        items: [],
        total: 0,
        offset: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: 'notLoggedIn',
      });
      return;
    }

    const gen = ++requestGenRef.current;
    setState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const page = await fetchMessages(auth, filter, firstPageSize, 0);
      if (gen !== requestGenRef.current) return;
      setState({
        items: page.items,
        total: page.total,
        offset: page.items.length,
        loading: false,
        loadingMore: false,
        hasMore: page.items.length < page.total,
      });
    } catch (error) {
      if (gen !== requestGenRef.current) return;
      setState({
        items: [],
        total: 0,
        offset: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: toErrorKey(error),
      });
    }
  }, [auth, filter, firstPageSize]);

  const loadMore = useCallback(async () => {
    if (!auth || state.loading || state.loadingMore || !state.hasMore) return;

    const gen = requestGenRef.current;
    setState(prev => ({ ...prev, loadingMore: true, error: undefined }));
    try {
      const page = await fetchMessages(auth, filter, PAGE_SIZE, state.offset);
      if (gen !== requestGenRef.current) return;
      setState(prev => {
        const merged = [...prev.items, ...page.items];
        return {
          ...prev,
          items: merged,
          total: page.total,
          offset: merged.length,
          loadingMore: false,
          hasMore: merged.length < page.total,
        };
      });
    } catch (error) {
      if (gen !== requestGenRef.current) return;
      setState(prev => ({
        ...prev,
        loadingMore: false,
        error: toErrorKey(error),
      }));
    }
  }, [auth, filter, state.loading, state.loadingMore, state.hasMore, state.offset]);

  // filter 变化或首次挂载时拉第一页
  useEffect(() => {
    void loadFirstPage();
    return () => {
      // 卸载/切 filter 时让进行中的请求失效
      requestGenRef.current++;
    };
  }, [loadFirstPage]);

  return { ...state, reload: loadFirstPage, loadMore };
};

/** 首次挂载读取登录态 */
export const useAuth = () => {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await readAuth();
      if (cancelled) return;
      setAuth(info);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { auth, ready };
};
