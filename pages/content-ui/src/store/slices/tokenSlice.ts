import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BinanceTokenScreenItem } from '@src/api/agent_c';

interface TokenState {
  tokenList: BinanceTokenScreenItem[];
}

const initialState: TokenState = {
  tokenList: [],
};

const tokenSlice = createSlice({
  name: 'tokens',
  initialState,
  reducers: {
    setTokenList: (state, action: PayloadAction<BinanceTokenScreenItem[]>) => {
      state.tokenList = action.payload;
    },
  },
});

export const { setTokenList } = tokenSlice.actions;
export default tokenSlice.reducer;
