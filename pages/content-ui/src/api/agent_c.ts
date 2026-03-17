import { API_BASE_URL } from './config';
import { service } from './service';
import { streamingRequest } from './request';

export type ApiResponse<T = unknown> = {
  code: number;
  msg?: string;
  data: T;
};

export type GetCexData = string[];
export interface GetCexResponse extends ApiResponse {
  data: {
    cex: GetCexData;
  };
}

export interface GetGainRankingItem {
  symbol: string;
  price: number;
  gain: number;
  image: string;
  collect: boolean;
  loading: boolean;
  symbol_type: 0 | 1 | 2;
}

export interface GetGainRankingCResponse extends ApiResponse {
  data: {
    res: GetGainRankingItem[];
    total: number;
  };
}

export interface GetCollectCResponse extends ApiResponse {
  data: {
    symbols: string[] | null;
  };
}

export interface ClaimInfoItem {
  claim_amount: number;
  claim_flag: boolean;
  claim_time: number;
  period_end: number;
  period_start: number;
}

export interface ClaimInfoResponse extends ApiResponse {
  data: {
    claim_info: ClaimInfoItem[];
    total_count: number;
  };
}

export interface PositionSymbolsParams {
  cex_name: string;
}
export interface PositionSymbolsItem {
  symbol: string;
  position_side: string;
  update_time: number;
}
export interface PositionSymbolsResponse extends ApiResponse {
  data: {
    symbols: PositionSymbolsItem[];
    total_count: number;
  };
}

const DEFAI_AGENT_API = '/defai_api';
const AGENT_API = '/agentApi';
const UPLOAD_API = '/uploadApi';

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

export type PlatformType = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface SetintegratedParams {
  app_type: PlatformType;
  token?: string;
  key?: string;
  client_id?: string;
  white_list?: string;
  phone_number_id?: string;
}
export interface SetintegratedResponse extends ApiResponse {
  data: {
    status: boolean;
  };
}
export const set_integrated = (params: SetintegratedParams): Promise<SetintegratedResponse> => {
  return service.post(`${AGENT_API}/v1/set_integrated`, params);
};
export interface GetUserInfoResponse extends ApiResponse {
  data: {
    web3_address: string;
    email: string;
    invite_code: string;
    invite_count: number;
  };
}

export const get_user_info = () => {
  return service.get<GetUserInfoResponse>(`${API_BASE_URL}/v1/get_userinfo`);
};

export const get_cex = (): Promise<GetCexResponse> => {
  return service.get<GetCexResponse>(`${API_BASE_URL}/v1/get_cex`).then(res => res as unknown as GetCexResponse);
};

export const get_gain_ranking_c = () => {
  return service.get<GetGainRankingCResponse>(`${API_BASE_URL}/v1/getgainranking`);
};

export const get_collect_c = () => {
  return service.get<GetCollectCResponse>(`${API_BASE_URL}/v1/get_collect`);
};

export const get_claim_info = (params: { cex_name: string }): Promise<ClaimInfoResponse> => {
  return service
    .post<ClaimInfoResponse>(`${API_BASE_URL}/v1/claim_info`, params)
    .then(res => res as unknown as ClaimInfoResponse);
};

export const position_symbols = (data: PositionSymbolsParams): Promise<PositionSymbolsResponse> => {
  return service
    .post<PositionSymbolsResponse>(`${API_BASE_URL}/v1/position_symbols`, data)
    .then(res => res as unknown as PositionSymbolsResponse);
};

export const set_collect_c = (symbol: string) => {
  return service.post<ApiResponse>(`${API_BASE_URL}/v1/set_collect`, { symbol });
};

export const cancel_collect_c = (symbol: string) => {
  return service.post<ApiResponse>(`${API_BASE_URL}/v1/cancel_collect`, { symbol });
};
export type ConversationType =
  | 'ALL'
  | 'SPACE'
  | 'API'
  | 'EMBED'
  | 'WIDGET'
  | 'AI_SEARCH'
  | 'SHARE'
  | 'WHATSAPP_META'
  | 'DINGTALK'
  | 'DISCORD'
  | 'SLACK'
  | 'ZAPIER'
  | 'WXKF'
  | 'TELEGRAM'
  | 'LIVECHAT'
  | 'ZAPIER';
export interface GetConversationListParams {
  conversation_type: ConversationType;
  start_time: number;
  end_time: number;
  page: number;
  page_size: number;
}

export interface ConversationItem {
  bot_id: string;
  conversation_id: string;
  conversation_type: string;
  cost_credit: number;
  message_count: number;
  recent_chat_time: number;
  subject: string;
  user_id: string;
}
export interface GetConversationResponse extends ApiResponse {
  data: {
    list: ConversationItem[];
    total: number;
  };
}

export const get_conversation_list = (params: GetConversationListParams): Promise<GetConversationResponse> => {
  return service.get(`${AGENT_API}/v1/get_conversation_list`, { params });
};

export type UserFeedBack = 'ALL' | 'NONE' | 'GOOD' | 'BAD';
export interface GetQAListParams {
  user_feedback: UserFeedBack;
  start_time: number;
  end_time: number;
  page: number;
  page_size: number;
}
export interface GetQAListItem {
  a: string;
  convo_id: string;
  convo_type: ConversationType;
  id: string;
  q: string;
  q_time: number;
  user_feedback: UserFeedBack;
  user_id: string;
}
export interface GetQAListResponse extends ApiResponse {
  data: {
    list: GetQAListItem[];
    total: number;
  };
}

export const get_qa_list = (params: GetQAListParams): Promise<GetQAListResponse> => {
  return service.get(`${AGENT_API}/v1/get_qa_list`, { params });
};

export const get_bot = () => {
  return fetch(new URL(`${UPLOAD_API}/v1/bot/detail`, API_BASE_URL).toString(), {
    headers: {
      Authorization: 'Bearer app-azA9fLGtyCJFxkF9vfMFDoxp',
    },
  });
};

export const uploadFile = () => {
  return fetch(new URL(`${UPLOAD_API}/v1/bot/data/file/upload`, API_BASE_URL).toString(), {
    method: 'post',
    headers: {
      Authorization: 'Bearer app-azA9fLGtyCJFxkF9vfMFDoxp',
    },
  });
};

export interface DocItem {
  data_id: string;
  data_status: 'PENDING_PARSE' | 'AVAILABLE' | 'PENDING_ASYNC_EMBEDDING' | 'PENDING_EMBEDDING';
  file_name: string;
  upload_time: number;
  update_time: number;
}
export interface GetFileListParams {
  page: number;
  size: number;
}
export interface GetFileListResponse extends ApiResponse {
  data: {
    total_count: number;
    doc: DocItem[];
  };
}
export const get_file_list = (params: GetFileListParams): Promise<GetFileListResponse> => {
  return service.post(`${AGENT_API}/v1/get_file_list`, params);
};

export interface SetIntegratedParams {
  bot_id: string;
  app_type: PlatformType;
  integrated_code_1?: string;
  integrated_code_2?: string;
  integrated_code_3?: string;
}
export const set_integrated_result = (params: SetIntegratedParams): Promise<GetFileListResponse> => {
  return service.post(`${AGENT_API}/v1/set_integrated_result`, params);
};

export interface InfoItem {
  user_id: string;
  bot_id: string;
  app_type: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  app_token: string;
  app_key: string;
  client_id: string;
  client_secret: string;
  bubble_list: string;
  integrated_code: string;
  set_flag: boolean;
  phone_number_id: string;
  integrated_code_1: string;
  integrated_code_2: string;
  integrated_code_3: string;
}
export interface GetIntegraInfosResponse extends ApiResponse {
  data: {
    IntegInfos: InfoItem[] | null;
  };
}
export const get_Integrated_infos = (): Promise<GetIntegraInfosResponse> => {
  return service.get(`${AGENT_API}/v1/get_Integrated_infos`);
};

export interface CreateOrderParams {
  commodity_id: number;
  payer_address: string;
  credits?: number;
}

export interface OrderInfo {
  order_id: string;
  commodity_id: number;
  pay_address: string;
  collection_address: string;
  amount: number;
  credits: number;
  coin_type: number;
  network_id: number;
  paid_amount: number;
  payment_status: 0 | 1 | 2 | 3;
  payment_time: number;
  quantity: number;
  sub_end_time: number;
  sub_start_time: number;
  tx_hash: string;
  user_id: string;
}

export interface CreateOrderResponse extends ApiResponse {
  data: {
    order: OrderInfo;
  };
}
export const create_order = (params: CreateOrderParams): Promise<CreateOrderResponse> => {
  return service.post(`${AGENT_API}/v1/create_order`, params);
};

export const get_unpayment_order = (params: { commodity_id: number }): Promise<CreateOrderResponse> => {
  return service.post(`${AGENT_API}/v1/get_unpayment_order`, params);
};

export interface UpdateOrderParams {
  order_id: string;
  tx_hash: string;
  payer_address?: `0x${string}`;
  credits: number;
  update_credit_flag: boolean;
}
export const update_order = (params: UpdateOrderParams) => {
  return service.post(`${AGENT_API}/v1/update_order`, params);
};

export interface GetUserOrdersParams {
  page: number;
  size: number;
}

export interface GetUserOrdersResponse extends ApiResponse {
  data: {
    orders: {
      order_list: OrderInfo[];
      total_count: number;
    };
  };
}
export const get_user_orders = (params: GetUserOrdersParams): Promise<GetUserOrdersResponse> => {
  return service.post(`${AGENT_API}/v1/get_user_orders`, params);
};

export interface GetUsingOrderResponse extends ApiResponse {
  data: {
    order: OrderInfo;
  };
}
export const get_using_order = (): Promise<GetUsingOrderResponse> => {
  return service.post(`${AGENT_API}/v1/get_using_order`);
};

export interface GetCreditResponse extends ApiResponse {
  data: {
    credits: number;
  };
}
export const get_credit = (): Promise<GetCreditResponse> => {
  return service.post(`${AGENT_API}/v1/get_credit`);
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

export interface AgentKOLItem {
  claim_num: number;
  contact: string;
  invite_code: string;
  total_invite: number;
  register_time: number;
}
export type GetAgentKOLResponse = {
  data?: {
    Res: AgentKOLItem[];
    Total: number;
  };
} & ApiResponse;

export interface PageParams {
  page: number;
  size: number;
}

export const get_agent_KOL = (params: PageParams): Promise<GetAgentKOLResponse> => {
  return service.post(`${AGENT_API}/v1/agentKOL`, params);
};

export interface AgentTwitterKOLItem {
  invite_user_claim_num: number;
  twitter_name: string;
  invite_code: string;
  invite_total: number;
  register_time: number;
}
export type GetTwitterAgentKOLResponse = {
  data?: {
    Res: AgentTwitterKOLItem[];
    Total: number;
  };
} & ApiResponse;

export const agentKOLDappTwitter = (params: PageParams): Promise<GetTwitterAgentKOLResponse> => {
  return service.post(`${AGENT_API}/v1/agentKOLDappTwitter`, params);
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
  return service.post(`${DEFAI_AGENT_API}/v1/login`, params);
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

export type GetAssetWithLogoItem = {
  asset: string;
  free: string;
  locked?: string;
  logo?: string;
};

export const get_asset_with_logo = (params: { cex_name: string }) => {
  return service.post<ApiResponse<{ assets: GetAssetWithLogoItem[] }>>(
    `${API_BASE_URL}/v1/get_asset_with_logo`,
    params,
  );
};

export const contract_expert_score = (params: { cex_name: string }) => {
  return service.post<ApiResponse<{ long_score?: number; short_score?: number }>>(
    `${API_BASE_URL}/v1/contract_expert_score`,
    params,
  );
};

export const spot_expert_score = (params: { cex_name: string }) => {
  return service.post<ApiResponse<{ score?: number }>>(`${API_BASE_URL}/v1/spot_expert_score`, params);
};

export interface AlphaTokenItem {
  symbol: string;
  icon_url: string;
  token_address?: string;
  price?: number;
  level?: number;
  color?: string;
  d2_result?: {
    slope: number;
  };
}
export interface QueryAlphaTokenInfoResponse extends ApiResponse {
  data: {
    tokens: AlphaTokenItem[];
  };
}
export const alpha_token_info = () => {
  return service.get<QueryAlphaTokenInfoResponse>(`${API_BASE_URL}/v1/alpha_token_info`, {
    timeout: 300000,
  });
};

// /update_time
export interface UpdateTimeResponse extends ApiResponse {
  data: {
    block_time: number;
  };
}
export const update_time = () => {
  return service.get<UpdateTimeResponse>(`${API_BASE_URL}/v1/update_time`, {
    timeout: 300000,
  });
};

export interface AlphaTokenPriceItem {
  symbol: string;
  token_address: string;
  price: number;
}
export interface AlphaTokenPriceParams {
  token_addresses: string[];
}
export interface AlphaTokenPriceResponse extends ApiResponse {
  data: {
    prices: AlphaTokenPriceItem[];
  };
}
export const alpha_token_price = async (params: AlphaTokenPriceParams): Promise<AlphaTokenPriceResponse> => {
  return service.post<ApiResponse<AlphaTokenPriceResponse>>(`${API_BASE_URL}/v1/alpha_token_price`, params, {
    timeout: 300000,
  });
};

export interface BinanceTokenPriceItem {
  token_address: string;
  price: number;
}

export interface GetBinanceTokenPriceResponse extends ApiResponse {
  data: {
    prices: BinanceTokenPriceItem[];
  };
}

export interface BinanceTokenScreenItem {
  tokenId: string; // Binance Token ID (CoinGecko ID)
  tokenSymbol: string; // 代币符号
  tokenName: string; // 代币名称
  contractAddress: string; // 合约地址
  poolAddress: string; // 主池地址
  poolType: string; // 池子类型 (V2/V3)
  quoteTokenSymbol: string; // 报价币符号
  depthScore: number; // 深度充足性分数
  stabilitySlope: number; // 深度稳定性斜率
  exitSlippage: number; // 退出可行性滑点
  overallScore: number; // 综合评分
  riskLevel: string; // 风险等级
  analysisResult: string; // 完整分析结果 JSON
  screeningTime: number; // 筛选时间
  lastUpdated: number; // 最后更新时间
  price?: number; // 代币价格（从价格接口获取）
  imageUrl: string;
}

export interface GetBinanceTokenScreenResponse extends ApiResponse {
  data: {
    results: BinanceTokenScreenItem[];
  };
}

export const getBinanceTokenScreen = (): Promise<GetBinanceTokenScreenResponse> => {
  return service.get(`/v1/binance_token_screen`).then(res => res as unknown as GetBinanceTokenScreenResponse);
};

/**
 * 获取币安代币价格
 * 使用代理路径 /defai_api/v1/binance_token_price
 * @param tokenAddresses 合约地址数组
 */
export const getBinanceTokenPrice = (tokenAddresses: string[]) => {
  return service
    .post(`/v1/binance_token_price`, {
      token_addresses: tokenAddresses,
    })
    .then(res => res as unknown as GetBinanceTokenPriceResponse);
};

/**
 * 获取币安代币筛选列表及价格
 * 组合接口：先获取筛选列表，再批量获取价格并合并
 */
export const getBinanceTokenScreenWithPrices = async (): Promise<BinanceTokenScreenItem[]> => {
  try {
    // 1. 获取筛选列表
    const screenResponse = await getBinanceTokenScreen();
    const tokens = screenResponse.data.results || [];

    if (tokens.length === 0) {
      return [];
    }

    // 2. 提取所有合约地址
    const contractAddresses = tokens
      .map(token => token.contractAddress || token.contract_address)
      .filter((address): address is string => Boolean(address));

    if (contractAddresses.length === 0) {
      return tokens;
    }

    // 3. 批量获取价格
    try {
      const priceResponse = await getBinanceTokenPrice(contractAddresses);
      const prices = priceResponse.data.prices || [];

      // 4. 创建价格映射表
      const priceMap = new Map<string, number>();
      prices.forEach(item => {
        priceMap.set(item.token_address.toLowerCase(), item.price);
      });

      // 5. 合并价格数据到代币列表
      return tokens.map(token => {
        const contractAddress = token.contractAddress || token.contract_address;
        const price =
          contractAddress && priceMap.has(contractAddress.toLowerCase())
            ? priceMap.get(contractAddress.toLowerCase())
            : undefined;

        return {
          ...token,
          price,
          contractAddress,
        };
      });
    } catch (priceError) {
      console.error('Failed to fetch prices, returning tokens without price:', priceError);
      // 价格获取失败时，返回不含价格的代币列表
      return tokens;
    }
  } catch (error) {
    console.error('Failed to fetch token screen:', error);
    throw error;
  }
};

export interface LiquidityCheckItem {
  token_address: string;
  symbol: string;
  d1_result: string;
  d2_result: string | Record<string, unknown>;
  color: string;
  level: number;
  description: string;
}
export interface LiquidityCheckResponse extends ApiResponse {
  data: {
    results: LiquidityCheckItem[];
  };
}
export const liquidity_check = async (params: AlphaTokenPriceParams): Promise<LiquidityCheckResponse> => {
  return service.post<LiquidityCheckResponse>(`${API_BASE_URL}/v1/liquidity_check`, params, {
    timeout: 300000,
  });
};

export type QueryTasksType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined;

export interface QueryTasksItem {
  type: QueryTasksType;
  point: string | undefined;
  timestamp: number | undefined;
}

export interface QueryTasksResponse extends ApiResponse {
  data: {
    Res: QueryTasksItem[];
    Total: number;
  } | null;
}

export interface QueryTasksParams {
  page: number;
  size: number;
}

export const query_tasks = (data: QueryTasksParams) => {
  return service.post<QueryTasksResponse>(`${API_BASE_URL}/v1/query_tasks`, data);
};

export interface AddUserApiKeyParams {
  apikey: string;
  secretkey: string;
  passphrase?: string;
  cex_name: string;
}

export const add_userapikey = (params: AddUserApiKeyParams): Promise<ApiResponse> => {
  return service.post(`${API_BASE_URL}/v1/add_userapikey`, params);
};

// Streaming API types
export interface StreamingSSEEvent {
  event: 'message' | 'workflow_started' | 'workflow_finished' | 'message_end';
  task_id?: string;
  id?: string;
  answer?: string;
  created_at?: number;
}

export type StreamingResponse =
  | StreamingSSEEvent
  | {
      data?: {
        analyse_result?: {
          output?: {
            output: string;
          };
        };
        recommend_result?: {
          output?: {
            output: string;
          };
        };
        text?: string;
        content?: string;
      };
      text?: string;
      content?: string;
      answer?: string;
    }
  | string;

// Streaming API functions
export const analyse_coin_c_streaming = (
  str: string,
  token?: string,
  endFun?: () => void,
  abortController?: AbortController,
) => {
  const requestBody: { input: string; token?: string } = {
    input: str,
  };

  return streamingRequest<StreamingResponse>(
    `${API_BASE_URL}/v1/analyse_coin2`,
    {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
    {
      endFun,
      abortController,
      parseMode: 'sse',
      forceDirect: true,
    },
  );
};

export const recommend_coin_c_streaming = (
  str: string,
  token?: string,
  endFun?: () => void,
  abortController?: AbortController,
) => {
  const requestBody: { input: string; token?: string } = {
    input: str,
  };

  return streamingRequest<StreamingResponse>(
    `${API_BASE_URL}/v1/recommend_coin2`,
    {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
    {
      endFun,
      abortController,
      parseMode: 'sse',
      forceDirect: true,
    },
  );
};

export const position_risk_management_streaming = (
  str: string,
  token?: string,
  endFun?: () => void,
  abortController?: AbortController,
) => {
  const requestBody: { input: string; token?: string } = {
    input: str,
  };

  return streamingRequest<StreamingResponse>(
    `${API_BASE_URL}/v1/position_risk_management2`,
    {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
    {
      endFun,
      abortController,
      parseMode: 'sse',
      forceDirect: true,
    },
  );
};

// /liquidity_check_dify

export const liquidity_check_dify = (str: string, endFun?: () => void, abortController?: AbortController) => {
  const requestBody: { input: string; token?: string } = {
    input: str,
  };

  return streamingRequest<StreamingResponse>(
    `${API_BASE_URL}/v1/liquidity_check_dify`,
    {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
    {
      endFun,
      abortController,
      parseMode: 'sse',
      forceDirect: true,
    },
  );
};

// Spot Price API
export interface SpotPriceRequest {
  symbol: string;
}

export interface SpotPriceResponse extends ApiResponse {
  data: {
    price: number;
  };
}

export const get_spot_price = (data: SpotPriceRequest): Promise<SpotPriceResponse> => {
  return service.post<SpotPriceResponse>(`${API_BASE_URL}/v1/getspotprice`, data);
};
