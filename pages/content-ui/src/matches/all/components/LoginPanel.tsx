import { Button, Copy, message } from '@src/ui';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@src/store';
import { useEffect, useState } from 'react';
import { user_rewardpoints } from '@src/api/user';
import {
  get_llax_balance,
  type LLAxBalanceData,
  get_user_info,
  get_llax_claim_nonce,
  claim_llax,
  confirm_llax_claim,
} from '@src/api/agent_c';
import { useI18n } from '@src/lib/i18n';
import { syncPoints, setOtherInfo } from '@src/store/slices/userSlice';
import { setSelectedMenuId } from '@src/store/slices/uiSlice';
import { switchBscChain } from '../lib/payment';
import { CHAIN_ID } from '../config/payment';
import { LLAX_CLAIM_CONTRACT_ADDRESS, llaxClaimAbi } from '../config/llaxClaim';
import { encodeFunctionData, keccak256, toBytes } from 'viem';

const executeViaBackgroundScript = async (method: string, args: unknown[] = []): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'WEB3_REQUEST', method, args }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      if (response?.success && response?.result !== undefined) {
        resolve(response.result);
        return;
      }
      reject(new Error('Invalid response from background script'));
    });
  });
};

const formatAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

interface LoginPanelProps {
  onLogout?: () => void;
  walletAddress?: string;
  walletChainId?: string;
  providerId?: string;
  isConnected?: boolean;
}

export const LoginPanel = ({
  onLogout,
  walletAddress = '',
  walletChainId = '',
  providerId = '',
  isConnected = false,
}: LoginPanelProps) => {
  const { t } = useI18n();
  const points = useSelector((state: RootState) => state.user.points);
  const icon = chrome.runtime.getURL('content-ui/loginPanel/icon.svg');
  const iconRounded = chrome.runtime.getURL('content-ui/loginPanel/iconRounded.svg');
  const music = chrome.runtime.getURL('content-ui/loginPanel/music.svg');
  const wallet = chrome.runtime.getURL('content-ui/loginPanel/wallet.svg');
  const email = chrome.runtime.getURL('content-ui/loginPanel/email.svg');
  const smallMoney = chrome.runtime.getURL('content-ui/smallMoney.svg');
  const smallPeople = chrome.runtime.getURL('content-ui/smallPeople.svg');
  const address = useSelector((state: RootState) => state.user.address);
  const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  const [llaxBalance, setLlaxBalance] = useState<LLAxBalanceData['balance'] | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  const fetchLlaxBalance = () => {
    get_llax_balance()
      .then(response => {
        setLlaxBalance(response.data?.balance ?? null);
      })
      .catch(() => {
        setLlaxBalance(null);
      });
  };

  const handleClaim = async () => {
    if (!address) {
      message.warning(t.loginPanel?.connectFirst ?? 'Please connect your wallet first');
      return;
    }
    if (claimLoading) return;

    const claimAddress = address;
    const claimChainId = walletChainId || '';
    const claimProviderId = providerId || '';

    // claim 前查询最新余额状态，检查冻结
    try {
      const balanceRes = await get_llax_balance();
      const frozen = balanceRes?.data?.balance?.frozen_amount ?? 0;
      const available = (balanceRes?.data?.balance?.balance ?? 0) - frozen;
      if (frozen > 0) {
        message.warning('You have a pending claim, please wait for it to complete.');
        return;
      }
      if (available <= 0) {
        message.warning('No LLAx available to claim');
        return;
      }
    } catch {
      // 查询失败继续走原有流程
    }

    setClaimLoading(true);
    try {
      // 1. 获取 nonce 和可领取金额
      const nonceRes = await get_llax_claim_nonce();
      const { nonce, amount } = nonceRes.data;

      if (!amount || amount <= 0) {
        message.warning('No LLAx available to claim');
        return;
      }

      // 2. 用户签名
      const timestamp = Math.floor(Date.now() / 1000);
      const signedMessage = [
        'Claim LLAx',
        `Amount: ${amount}`,
        `To: ${claimAddress}`,
        `Nonce: ${nonce}`,
        `Timestamp: ${timestamp}`,
      ].join('\n');

      const signature = claimProviderId
        ? ((await executeViaBackgroundScript('wallet_signMessage', [
            claimProviderId,
            signedMessage,
            claimAddress,
          ])) as string)
        : ((await executeViaBackgroundScript('personal_sign', [signedMessage, claimAddress])) as string);

      // 3. 提交到后端，获取合约调用参数
      const claimRes = await claim_llax({
        to_address: claimAddress,
        signature,
        signed_message: signedMessage,
      });

      console.log('[Claim] claim_llax response:', JSON.stringify(claimRes));
      const claimData = claimRes?.data;
      if (!claimData?.chain_amount || !claimData?.deadline) {
        console.error('[Claim] Missing chain_amount or deadline:', claimData);
        message.error('Invalid claim response from server');
        return;
      }

      const { chain_amount, contract_address, nonce: claimNonce, deadline, signature: opsSignature } = claimData;

      const claimContractAddress = (contract_address || LLAX_CLAIM_CONTRACT_ADDRESS) as `0x${string}`;
      console.log('[Claim] Using contract address:', claimContractAddress);
      console.log('[Claim] chain_amount:', chain_amount, 'nonce:', claimNonce, 'deadline:', deadline);

      // 4. 切换到正确的链（BSC）
      const currentChainId = claimChainId?.startsWith('0x') ? Number.parseInt(claimChainId, 16) : Number(claimChainId);
      if (currentChainId !== CHAIN_ID) {
        await switchBscChain(CHAIN_ID, claimProviderId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 5. 调用合约 claim(uint256 amount, bytes32 nonce, uint256 deadline, bytes signature)
      const nonceBytes32 = keccak256(toBytes(claimNonce));
      console.log('[Claim] nonceBytes32:', nonceBytes32);

      message.info('Submitting on-chain transaction...');

      const data = encodeFunctionData({
        abi: llaxClaimAbi,
        functionName: 'claim',
        args: [BigInt(chain_amount), nonceBytes32, BigInt(deadline), opsSignature as `0x${string}`],
      });
      console.log('[Claim] Encoded call data:', data);
      const txHash = (await executeViaBackgroundScript('eth_sendTransaction', [
        {
          from: claimAddress,
          to: claimContractAddress,
          data,
          gas: '0x493e0',
        },
      ])) as string;

      message.info(`TX submitted: ${txHash.slice(0, 10)}..., waiting for confirmation...`);

      // 6. 等待交易收据
      let receipt: { status: string | number } | null = null;
      for (let i = 0; i < 30; i++) {
        try {
          const r = await executeViaBackgroundScript('eth_getTransactionReceipt', [txHash]);
          if (r && (r as { status?: unknown }).status !== undefined) {
            receipt = r as { status: string | number };
            break;
          }
        } catch {
          // not available yet
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!receipt) {
        message.error('Transaction receipt timeout');
        return;
      }

      const receiptStatus = typeof receipt.status === 'string' ? receipt.status : String(receipt.status);

      if (receiptStatus === '0x1' || receiptStatus === '1') {
        message.success(`Claim succeeded! TX: ${txHash.slice(0, 10)}...`);
        fetchLlaxBalance();
        try {
          await confirm_llax_claim({ claim_id: claimRes.data.claim_id, tx_hash: txHash });
          setTimeout(() => fetchLlaxBalance(), 2000);
        } catch {
          // 后端确认失败不影响用户
        }
      } else {
        message.error(`Transaction reverted on chain. TX: ${txHash.slice(0, 10)}...`);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; code?: number; msg?: string; shortMessage?: string };
      if (err?.message?.includes('User rejected') || err?.code === 4001) {
        message.info('Transaction cancelled');
      } else if (err?.shortMessage?.includes('reverted') || err?.message?.includes('reverted')) {
        message.error('Contract transaction reverted');
      } else {
        const errMsg = err?.msg || err?.shortMessage || err?.message || 'Claim failed';
        message.error(errMsg);
      }
      fetchLlaxBalance();
    } finally {
      setClaimLoading(false);
    }
  };

  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(syncPoints());
    fetchLlaxBalance();
    get_user_info()
      .then(response => {
        const info = response.data;
        dispatch(
          setOtherInfo({
            web3_address: info.web3_address,
            email: info.email,
            invite_code: info.invite_code,
            invite_count: info.invite_count,
            image: otherInfo.image ?? '',
          }),
        );
      })
      .catch(() => {
        // ignore
      });
  }, [dispatch]);

  return (
    <div className="w-[370px]">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="h-[4.2vh] w-[4.2vh] overflow-hidden rounded-full border-[2px] border-solid border-black bg-[#cf0]">
            <img src={otherInfo.image} className="h-full w-full rounded-full" alt="" />
          </div>
          <div className="items-cenetr flex gap-2">
            <img src={icon}></img>
            <img src={iconRounded}></img>
          </div>
        </div>
        <Button id="logout" size="small" className="bg-[#cf0]" style={{ background: '#cf0' }} onClick={onLogout}>
          <span className="flex items-center gap-2 font-bold">{t.loginPanel?.logout || 'Log out'}</span>
        </Button>
      </div>
      <div className="mt-[2vh] flex flex-col gap-[2px]">
        <div className="h-[52px] rounded-[8px] bg-[#F2F2F2] px-2 py-3">
          <div className="flex gap-2">
            <div>
              <img src={smallMoney} alt=""></img>
            </div>
            <div>
              <div className="text-[12px] text-[#666666]">{t.loginPanel?.myPoints || 'My Points'}</div>
              <div>{points || '---'}</div>
            </div>
            <div className="flex flex-1 items-center justify-end" id="to-points">
              <button
                type="button"
                className="cursor-pointer rounded-full p-1 hover:bg-black/10"
                onClick={() => {
                  dispatch(setSelectedMenuId(6));
                }}>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M7.5 4.5 12.5 10l-5 5.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="flex h-[52px] rounded-[8px] bg-[#F2F2F2] px-2 py-3">
          <div className="flex gap-2">
            <div>
              <img src={wallet} alt=""></img>
            </div>
            <div>
              <div className="text-[12px] text-[#666666]">{t.loginPanel?.evmAddress || 'EVM Address'}</div>
              <div className="text-[12px] font-bold text-black" title={address}>
                {formatAddress(address, 14, 10)}
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end">
            <Copy text={address}></Copy>
          </div>
        </div>
        <div className="h-[52px] rounded-[8px] bg-[#F2F2F2] px-2 py-3">
          <div className="flex gap-2">
            <div>
              <img src={email} alt=""></img>
            </div>
            <div>
              <div className="text-[12px] text-[#666666]">{t.loginPanel?.emailAddress || 'Email Address'}</div>
              <div>{otherInfo.email || '---'}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-[4px]">
          <div className="h-[52px] w-[20%] rounded-[8px] bg-[#cf0] px-2 py-3">
            <div className="flex h-full items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={smallPeople} alt="" />
              </div>
              <div className="font-bold text-black">{otherInfo.invite_count || '0'}</div>
            </div>
          </div>
          <div className="h-[52px] flex-1 rounded-[8px] bg-[#E9FF93] px-2 py-3">
            <div className="flex h-full items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={smallMoney} alt="" />
                <div className="text-[12px] text-[#666666]">LLAx</div>
                {/* <Copy text={LLAX_TOKEN_CONTRACT_ADDRESS} /> */}
              </div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-black">
                {llaxBalance && (llaxBalance.frozen_amount ?? 0) > 0 ? (
                  <span className="whitespace-nowrap font-normal text-[#666]" title={t.claim?.frozenTip ?? ''}>
                    ({t.claim?.frozenAmount ?? 'Frozen'}: {llaxBalance.frozen_amount})
                  </span>
                ) : (
                  <span>{llaxBalance?.balance}</span>
                )}
              </div>
              <Button onClick={handleClaim} disabled={claimLoading || !llaxBalance || llaxBalance.balance <= 0}>
                {claimLoading ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-[2vh]">
          <img src={music} className="w-full" alt=""></img>
        </div>
      </div>
    </div>
  );
};
