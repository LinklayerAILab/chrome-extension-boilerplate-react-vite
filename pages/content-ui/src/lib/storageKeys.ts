export const STORAGE_PREFIX = '@Linklayerai/';

const withPrefix = (key: string) => `${STORAGE_PREFIX}${key}`;

export const ACCESS_TOKEN_KEY = withPrefix('access_token');
export const ADDRESS_KEY = withPrefix('address');
export const INVITE_CODE_KEY = withPrefix('invite_code');
export const OTHER_INFO_KEY = withPrefix('otherInfo');
export const WALLET_STATE_KEY = withPrefix('wallet_state');
export const LOCALE_KEY = withPrefix('content-ui-locale');
export const WEB_APP_DATA_KEY = withPrefix('webAppData');
