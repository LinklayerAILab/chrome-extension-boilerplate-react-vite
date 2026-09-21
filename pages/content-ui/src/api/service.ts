import axios, { AxiosError } from 'axios';
import { ACCESS_TOKEN_KEY, ADDRESS_KEY } from '@src/lib/storageKeys';
import { handleUnauthorizedSession } from '@src/lib/sessionCleanup';
import { API_BASE_URL } from './config';

/** 业务错误：在 Error 上附加响应体中的 code / data（如 Stripe 6006 恢复支付需要读取） */
export type ApiError = Error & { code?: number; data?: unknown };

const toApiError = (
  body: { code?: number; message?: string; msg?: string; data?: unknown } | undefined,
  fallbackMsg: string,
): ApiError => {
  const err = new Error(body?.message || body?.msg || fallbackMsg) as ApiError;
  if (body?.code !== undefined) err.code = body.code;
  if (body?.data !== undefined) err.data = body.data;
  return err;
};

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
    config.headers.set('Source', '5');
  } else if (config.headers) {
    (config.headers as Record<string, string>)['Source'] = '5';
  } else {
    config.headers = { Source: '5' };
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
    // 兼容后端 HTTP 200 + body {code: 401} 的过期场景，同样触发完整会话清理
    if (response.data?.code === 401) {
      handleUnauthorizedSession();
    }
    if (response.data?.code !== 0) {
      return Promise.reject(toApiError(response.data, 'Request failed'));
    }
    return response.data;
  },
  (error: AxiosError<any>) => {
    const data = error.response?.data as { code?: number; message?: string } | undefined;
    // 只处理 401 错误，其他错误构造 Error 对象抛出
    if (data?.code === 401 || error.response?.status === 401) {
      handleUnauthorizedSession();
    }

    const msg = data?.message || error.message || 'Network error';
    return Promise.reject(toApiError(data, msg));
  },
);
