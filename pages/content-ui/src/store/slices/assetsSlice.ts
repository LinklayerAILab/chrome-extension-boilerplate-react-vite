import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CEX_NAME } from '../../matches/all/lib/enum';
import {
  contract_expert_score,
  get_asset_with_logo,
  spot_expert_score,
  type GetAssetWithLogoItem,
} from '../../api/agent_c';

export const getSyncAssets = createAsyncThunk<GetAssetWithLogoItem[], CEX_NAME, { rejectValue: string }>(
  'user/syncAssets',
  async (cex_name, { rejectWithValue }) => {
    try {
      const response = await get_asset_with_logo({ cex_name: cex_name.toLowerCase() });
      return response.data.assets || [];
    } catch {
      return rejectWithValue('Failed to sync assets');
    }
  },
);

export const getContractExpertScore = createAsyncThunk<
  { long_score?: number; short_score?: number },
  CEX_NAME,
  { rejectValue: string }
>('assets/getContractExpertScore', async (cex_name, { rejectWithValue }) => {
  try {
    const response = await contract_expert_score({ cex_name: cex_name.toLowerCase() });
    return response.data;
  } catch {
    return rejectWithValue('Failed to get contract expert score');
  }
});

export const getSpotExpertScore = createAsyncThunk<{ score?: number }, CEX_NAME, { rejectValue: string }>(
  'assets/getSpotExpertScore',
  async (cex_name, { rejectWithValue }) => {
    try {
      const response = await spot_expert_score({ cex_name: cex_name.toLowerCase() });
      return response.data;
    } catch {
      return rejectWithValue('Failed to get spot expert score');
    }
  },
);

type AssetsState = {
  loading: boolean;
  assets: GetAssetWithLogoItem[];
  selectCex: CEX_NAME;
  longScore: number;
  contractExpertScoreLoading: boolean;
  shortScore: number;
  spotScore: number;
  spotExpertScoreLoading: boolean;
};

const initialState: AssetsState = {
  loading: false,
  assets: [],
  selectCex: 'Binance',
  longScore: 0,
  contractExpertScoreLoading: false,
  shortScore: 0,
  spotScore: 0,
  spotExpertScoreLoading: false,
};

const assetsSlice = createSlice({
  name: 'assetsSlice',
  initialState,
  reducers: {
    setAssets(state, action: PayloadAction<GetAssetWithLogoItem[]>) {
      state.assets = action.payload;
    },
    setSelectCex(state, action: PayloadAction<CEX_NAME>) {
      state.selectCex = action.payload;
    },
    setLongScore(state, action: PayloadAction<number>) {
      state.longScore = action.payload;
    },
    setShortScore(state, action: PayloadAction<number>) {
      state.shortScore = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getSyncAssets.pending, state => {
        state.loading = true;
      })
      .addCase(getSyncAssets.fulfilled, (state, action) => {
        state.loading = false;
        const sortedAssets = [...action.payload].sort((a, b) => {
          const freeA = Number.parseFloat(a.free) || 0;
          const freeB = Number.parseFloat(b.free) || 0;
          return freeB - freeA;
        });
        state.assets = sortedAssets;
      })
      .addCase(getSyncAssets.rejected, state => {
        state.loading = false;
      })
      .addCase(getContractExpertScore.pending, state => {
        state.contractExpertScoreLoading = true;
      })
      .addCase(getContractExpertScore.fulfilled, (state, action) => {
        state.contractExpertScoreLoading = false;
        state.longScore = action.payload?.long_score || 0;
        state.shortScore = action.payload?.short_score || 0;
      })
      .addCase(getContractExpertScore.rejected, state => {
        state.contractExpertScoreLoading = false;
      })
      .addCase(getSpotExpertScore.pending, state => {
        state.spotExpertScoreLoading = true;
      })
      .addCase(getSpotExpertScore.fulfilled, (state, action) => {
        state.spotExpertScoreLoading = false;
        state.spotScore = action.payload?.score || 0;
      })
      .addCase(getSpotExpertScore.rejected, state => {
        state.spotExpertScoreLoading = false;
      });
  },
});

export const { setAssets, setSelectCex, setShortScore, setLongScore } = assetsSlice.actions;

export default assetsSlice.reducer;
