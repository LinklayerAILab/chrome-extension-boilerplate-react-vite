import { configureStore } from '@reduxjs/toolkit';
import assetsReducer from './slices/assetsSlice';
import userReducer from './slices/userSlice';
import uiReducer from './slices/uiSlice';
import pageInfoReducer from './slices/pageInfoSlice';
import tokenReducer from './slices/tokenSlice';
import guardReducer from './slices/guardSlice';

export const store = configureStore({
  reducer: {
    assets: assetsReducer,
    user: userReducer,
    ui: uiReducer,
    pageInfo: pageInfoReducer,
    tokens: tokenReducer,
    guard: guardReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
