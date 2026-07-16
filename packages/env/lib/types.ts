import type { dynamicEnvValues } from './index.js';

interface ICebEnv {
  readonly CEB_EXAMPLE: string;
  readonly CEB_DEV_LOCALE: string;
  readonly CEB_AGENT_C_API_DEV: string;
  readonly CEB_AGENT_C_API_PROD: string;
  readonly CEB_PAYEE_ADDRESS_DEV: string;
  readonly CEB_PAYEE_ADDRESS_PROD: string;
  readonly CEB_USDT_ADDRESS_DEV: string;
  readonly CEB_USDT_ADDRESS_PROD: string;
  readonly CEB_USDC_ADDRESS_DEV: string;
  readonly CEB_USDC_ADDRESS_PROD: string;
  readonly CEB_CHAIN_ID_DEV: string;
  readonly CEB_CHAIN_ID_PROD: string;
  readonly CEB_CHAIN_NAME_DEV: string;
  readonly CEB_CHAIN_NAME_PROD: string;
  readonly CEB_USDT_DECIMAL_DEV: string;
  readonly CEB_USDT_DECIMAL_PROD: string;
  readonly CEB_USDC_DECIMAL_DEV: string;
  readonly CEB_USDC_DECIMAL_PROD: string;
  readonly CEB_SIWE_DOMAIN: string;
  readonly CEB_TEST_SIWE_DOMAIN: string;
  readonly CEB_PROD_SIWE_DOMAIN: string;
}

interface ICebCliEnv {
  readonly CLI_CEB_DEV: string;
  readonly CLI_CEB_FIREFOX: string;
}

export type EnvType = ICebEnv & ICebCliEnv & typeof dynamicEnvValues;
