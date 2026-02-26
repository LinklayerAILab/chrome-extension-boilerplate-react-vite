import { createSlice } from '@reduxjs/toolkit';
import type { LocaleMessages } from '@src/lib/i18n';
import { locales } from '@src/lib/i18n';

export interface PageInfo {
  title: string;
  description: string;
}

type PageInfoState = {
  alpha: PageInfo;
  api: PageInfo;
  earn: PageInfo;
  perps: PageInfo;
  poliet: PageInfo;
  points: PageInfo;
};

// 默认英文初始状态（用于 Redux store 初始化）
const defaultInitialState: PageInfoState = {
  alpha: {
    title: 'Alpha',
    description: 'Real-time liquidity view for your Binance Alpha positions',
  },
  api: {
    title: 'Upload API',
    description: 'Connect Read-Only API to unlock position analysis',
  },
  earn: {
    title: 'Earn LLAx',
    description: 'Claim LLAx from past perps losses and monthly trading records.',
  },
  perps: {
    title: 'Perps Agent',
    description: 'Monitor and analyze your live perps exposure.',
  },
  poliet: {
    title: 'Picker Agent',
    description: 'Analyze Binance spot and futures markets',
  },
  points: {
    title: 'Points',
    description: 'Recharge credits and view points history',
  },
};

// 根据语言获取翻译后的初始状态
const getTranslatedInitialState = (locale?: keyof typeof locales): PageInfoState => {
  const messages: LocaleMessages = locale ? locales[locale] : locales.en;

  return {
    alpha: {
      title: messages.pageInfo?.alpha?.title || defaultInitialState.alpha.title,
      description: messages.pageInfo?.alpha?.description || defaultInitialState.alpha.description,
    },
    api: {
      title: messages.pageInfo?.api?.title || defaultInitialState.api.title,
      description: messages.pageInfo?.api?.description || defaultInitialState.api.description,
    },
    earn: {
      title: messages.pageInfo?.earn?.title || defaultInitialState.earn.title,
      description: messages.pageInfo?.earn?.description || defaultInitialState.earn.description,
    },
    perps: {
      title: messages.pageInfo?.perps?.title || defaultInitialState.perps.title,
      description: messages.pageInfo?.perps?.description || defaultInitialState.perps.description,
    },
    poliet: {
      title: messages.pageInfo?.poliet?.title || defaultInitialState.poliet.title,
      description: messages.pageInfo?.poliet?.description || defaultInitialState.poliet.description,
    },
    points: {
      title: messages.pageInfo?.points?.title || defaultInitialState.points.title,
      description: messages.pageInfo?.points?.description || defaultInitialState.points.description,
    },
  };
};

const initialState: PageInfoState = defaultInitialState;

const pageInfoSlice = createSlice({
  name: 'pageInfo',
  initialState,
  reducers: {
    setPageInfo: (state, action: { payload: { page: keyof PageInfoState; info: Partial<PageInfo> } }) => {
      const { page, info } = action.payload;
      state[page] = { ...state[page], ...info };
    },
    setPageTitle: (state, action: { payload: { page: keyof PageInfoState; title: string } }) => {
      const { page, title } = action.payload;
      state[page].title = title;
    },
    setPageDescription: (state, action: { payload: { page: keyof PageInfoState; description: string } }) => {
      const { page, description } = action.payload;
      state[page].description = description;
    },
    updateAllPageInfo: (state, action: { payload: PageInfoState }) => {
      return { ...state, ...action.payload };
    },
  },
});

export const { setPageInfo, setPageTitle, setPageDescription, updateAllPageInfo } = pageInfoSlice.actions;

// Selectors
export const selectPageInfo = (page: keyof PageInfoState) => (state: { pageInfo: PageInfoState }) =>
  state.pageInfo[page];

export const selectPageTitle = (page: keyof PageInfoState) => (state: { pageInfo: PageInfoState }) =>
  state.pageInfo[page].title;

export const selectPageDescription = (page: keyof PageInfoState) => (state: { pageInfo: PageInfoState }) =>
  state.pageInfo[page].description;

// 导出辅助函数用于更新所有页面的翻译
export const updatePageInfoTranslations = (locale?: keyof typeof locales) => {
  return getTranslatedInitialState(locale);
};

export default pageInfoSlice.reducer;
