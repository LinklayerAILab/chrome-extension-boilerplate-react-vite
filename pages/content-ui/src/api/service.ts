import axios, { AxiosError } from 'axios';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY } from '@src/lib/storageKeys';
import { store } from '@src/store';
import { setIsLogin } from '@src/store/slices/userSlice';
import { API_BASE_URL } from './config';

export const service = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
  },
  timeout: 60000,
});

service.interceptors.request.use(config => {
  const address = window.localStorage.getItem(ADDRESS_KEY);
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);

  if (address) {
    if (config.headers?.set) {
      config.headers.set('Address', address);
    } else if (config.headers) {
      (config.headers as Record<string, string>)['Address'] = address;
    } else {
      config.headers = { Address: address };
    }
  }

  if (config.headers?.set) {
    config.headers.set('Source', '1');
  } else if (config.headers) {
    (config.headers as Record<string, string>)['Source'] = '1';
  } else {
    config.headers = { Source: '1' };
  }

  if (accessToken) {
    if (config.headers?.set) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    } else if (config.headers) {
      (config.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    } else {
      config.headers = { Authorization: `Bearer ${accessToken}` };
    }
  }

  return config;
});

service.interceptors.response.use(
  response => {
    if (response.status !== 200) {
      return Promise.reject(response);
    }
    if (response.data?.code !== 0) {
      return Promise.reject(response);
    }
    return response.data;
  },
  (error: AxiosError<any>) => {
    const data = error.response?.data as { code?: number; message?: string } | undefined;
    // 只处理 401 错误，其他错误不显示 Message
    if (data?.code === 401 || error.response?.status === 401) {
      store.dispatch(setIsLogin(false));
      window.dispatchEvent(new Event('unauthorized'));
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }

    return Promise.reject(error);
  },
);
