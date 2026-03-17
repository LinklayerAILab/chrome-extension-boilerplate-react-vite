import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type UiState = {
  selectedMenuId: number;
  isSidePanelOpen: boolean;
};

const initialState: UiState = {
  selectedMenuId: 7,
  isSidePanelOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedMenuId: (state, action: PayloadAction<number>) => {
      state.selectedMenuId = action.payload;
    },
    setSidePanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isSidePanelOpen = action.payload;
    },
  },
});

export const { setSelectedMenuId, setSidePanelOpen } = uiSlice.actions;
export default uiSlice.reducer;
