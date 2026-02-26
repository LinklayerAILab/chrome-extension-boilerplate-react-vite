import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { user_rewardpoints } from '../../api/user';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY, INVITE_CODE_KEY, OTHER_INFO_KEY } from '@src/lib/storageKeys';

type OtherInfo = {
  web3_address: string;
  email: string;
  invite_code: string;
  invite_count: number;
  image: string;
};

type UserState = {
  address: string;
  access_token: string;
  isLogin: boolean;
  points: number;
  pointsLoading: boolean;
  otherInfo: OtherInfo;
};

const emptyOtherInfo: OtherInfo = {
  web3_address: '',
  email: '',
  invite_code: '',
  invite_count: 0,
  image: '',
};

const initialState: UserState = {
  address: '',
  access_token: '',
  isLogin: false,
  points: 0,
  pointsLoading: false,
  otherInfo: emptyOtherInfo,
};

export const syncPoints = createAsyncThunk<number, void, { rejectValue: string }>(
  'user/syncPoints',
  async (_, { rejectWithValue }) => {
    try {
      const response = await user_rewardpoints();
      return response.data.reward_points;
    } catch {
      return rejectWithValue('Failed to sync points');
    }
  },
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    initializeFromLocalStorage: state => {
      state.address = window.localStorage.getItem(ADDRESS_KEY) || '';
      state.access_token = window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
      state.isLogin = Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));
      state.otherInfo = JSON.parse(window.localStorage.getItem(OTHER_INFO_KEY) || '{}');
    },
    setUserInfo: (state, action: PayloadAction<{ access_token: string; address: string }>) => {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, action.payload.access_token);
      window.localStorage.setItem(ADDRESS_KEY, action.payload.address);
      state.access_token = action.payload.access_token;
      state.address = action.payload.address;
      state.isLogin = true;
    },
    setOtherInfo: (state, action: PayloadAction<OtherInfo>) => {
      state.otherInfo = action.payload;
      window.localStorage.setItem(OTHER_INFO_KEY, JSON.stringify(action.payload));
    },
    setPoints: (state, action: PayloadAction<number>) => {
      state.points = action.payload;
    },
    setIsLogin: (state, action: PayloadAction<boolean>) => {
      state.isLogin = action.payload;
    },
    logout: state => {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(OTHER_INFO_KEY);
      window.localStorage.removeItem(INVITE_CODE_KEY);
      window.localStorage.removeItem(ADDRESS_KEY);
      state.access_token = '';
      state.address = '';
      state.isLogin = false;
      state.points = 0;
      state.pointsLoading = false;
      state.otherInfo = emptyOtherInfo;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(syncPoints.pending, state => {
        state.pointsLoading = true;
      })
      .addCase(syncPoints.fulfilled, (state, action) => {
        state.pointsLoading = false;
        state.points = action.payload;
      })
      .addCase(syncPoints.rejected, state => {
        state.pointsLoading = false;
      });
  },
});

export const { setUserInfo, logout, setPoints, initializeFromLocalStorage, setOtherInfo, setIsLogin } =
  userSlice.actions;

export default userSlice.reducer;
