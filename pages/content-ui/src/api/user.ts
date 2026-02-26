import { service } from './service';
import { API_BASE_URL } from './config';

const DEFAI_AGENT_API = API_BASE_URL;
const AGENT_API = API_BASE_URL;

export interface ApiResponse {
  code: number;
  msg: string;
}

export interface LoginParams {
  sig_msg: string;
  signature: string;
}

export interface LoginResponse extends ApiResponse {
  data: {
    access_token: string;
    user_id: string;
    iframe: string;
  };
}

export const login = (params: LoginParams) => {
  return service.post<LoginResponse>(`${DEFAI_AGENT_API}/v1/login`, params);
};

export interface GetUserRewardpointResponse extends ApiResponse {
  data: {
    reward_points: number;
  };
}

export const user_rewardpoints = (): Promise<GetUserRewardpointResponse> => {
  return service.get(`${DEFAI_AGENT_API}/v1/user_rewardpoints`);
};

export const validate_token = (): Promise<LoginResponse> => {
  return service.post(`${AGENT_API}/v1/validate_token`);
};

export const logout = () => {
  return service.post(`${AGENT_API}/v1/logout`);
};

export interface SetLoginCodeResponse extends ApiResponse {
  data: {
    login_code: string;
  };
}
export interface SetLoginCodeParams {
  bot_id: string;
}
export const set_logincode = (params: SetLoginCodeParams): Promise<SetLoginCodeResponse> => {
  return service.post(`${AGENT_API}/v1/set_logincode`, params);
};

export interface TgParams {
  user_id: string;
  user_name: string;
  first_name: string;
  last_name: string;
  invite_code: string;
}

export interface TgResponse extends ApiResponse {
  data: {
    access_token: string;
    iframe: string;
    user_id: string;
  };
}

export const tgLogin = (params: TgParams) => {
  return service.post<TgResponse>(`${DEFAI_AGENT_API}/v1/login`, params);
};

export interface NonceResponse extends ApiResponse {
  data: {
    nonce: string;
  };
}
export const getSiweNonce = async (): Promise<NonceResponse> => {
  return service.get(`${DEFAI_AGENT_API}/v1/nonce`);
};

export interface SiweVerifyResponse extends ApiResponse {
  data: {
    access_token: string;
    address: string;
    chainId: number;
  };
}
export interface SiweVerifyParams {
  message: string;
  signature: string;
  invite_code?: string;
}
export const verifySiweMessage = (params: SiweVerifyParams): Promise<SiweVerifyResponse> => {
  return service.post(`${DEFAI_AGENT_API}/v1/login`, params);
};
