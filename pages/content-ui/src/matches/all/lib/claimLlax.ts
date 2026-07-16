import { encodeFunctionData, keccak256, toBytes } from 'viem';
import {
  get_llax_balance,
  get_llax_claim_nonce,
  claim_llax,
  confirm_llax_claim,
  get_llax_claim_records,
} from '@src/api/agent_c';
import type { LLAxClaimData, LLAxClaimRecord } from '@src/api/agent_c';
import { switchBscChain } from './payment';
import { CHAIN_ID } from '../config/payment';
import { LLAX_CLAIM_CONTRACT_ADDRESS, llaxClaimAbi } from '../config/llaxClaim';

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

export const buildClaimMessage = (amount: number, address: string, nonce: string, timestamp: number): string => {
  return `Claim LLAx\nAmount: ${amount}\nTo: ${address}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
};

const signMessage = async (messageToSign: string, address: string, providerId?: string): Promise<string> => {
  if (providerId) {
    return executeViaBackgroundScript('wallet_signMessage', [providerId, messageToSign, address]) as Promise<string>;
  }
  return executeViaBackgroundScript('personal_sign', [messageToSign, address]) as Promise<string>;
};

const executeClaimContract = async (
  chainAmount: string,
  nonceHash: string,
  deadline: number,
  opsSignature: string,
  userAddress: string,
  contractAddress: string,
): Promise<string> => {
  const targetAddress = (contractAddress || LLAX_CLAIM_CONTRACT_ADDRESS) as `0x${string}`;
  const data = encodeFunctionData({
    abi: llaxClaimAbi,
    functionName: 'claim',
    args: [BigInt(chainAmount), nonceHash as `0x${string}`, BigInt(deadline), opsSignature as `0x${string}`],
  });

  const txHash = await executeViaBackgroundScript('eth_sendTransaction', [
    {
      from: userAddress,
      to: targetAddress,
      data,
      gas: '0x493e0',
    },
  ]);
  return txHash as string;
};

const waitForTransactionReceipt = async (txHash: string, maxAttempts = 30): Promise<{ status: string | number }> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await executeViaBackgroundScript('eth_getTransactionReceipt', [txHash]);
      if (receipt && (receipt as { status?: unknown }).status !== undefined) {
        return receipt as { status: string | number };
      }
    } catch {
      // Receipt not available yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Transaction receipt timeout');
};

export type ClaimStep =
  | 'idle'
  | 'checking-balance'
  | 'fetching-nonce'
  | 'signing-message'
  | 'submitting-claim'
  | 'switching-chain'
  | 'executing-contract'
  | 'waiting-receipt'
  | 'confirming-claim'
  | 'success'
  | 'error';

export interface ClaimFlowResult {
  success: boolean;
  step: ClaimStep;
  error?: string;
  txHash?: string;
  claimId?: number;
}

export const executeClaimFlow = async (
  walletAddress: string,
  walletChainId: string,
  providerId?: string,
  onStepChange?: (step: ClaimStep) => void,
): Promise<ClaimFlowResult> => {
  const setStep = (step: ClaimStep) => onStepChange?.(step);

  try {
    setStep('checking-balance');
    const balanceResponse = await get_llax_balance();
    const balanceData = balanceResponse.data?.balance;
    if (!balanceData || balanceData.balance <= 0) {
      return { success: false, step: 'checking-balance', error: 'No LLAx available to claim' };
    }
    const frozen = balanceData.frozen_amount ?? 0;
    if (frozen > 0) {
      return { success: false, step: 'checking-balance', error: 'You have a pending claim' };
    }

    setStep('fetching-nonce');
    const nonceResponse = await get_llax_claim_nonce();
    const { nonce, amount } = nonceResponse.data;
    if (!nonce || amount <= 0) {
      return { success: false, step: 'fetching-nonce', error: 'No claimable amount' };
    }

    setStep('signing-message');
    const timestamp = Math.floor(Date.now() / 1000);
    const messageToSign = buildClaimMessage(amount, walletAddress, nonce, timestamp);
    const signature = await signMessage(messageToSign, walletAddress, providerId ?? undefined);

    setStep('submitting-claim');
    const claimResponse = await claim_llax({
      to_address: walletAddress,
      signature,
      signed_message: messageToSign,
    });
    const claimData: LLAxClaimData = claimResponse.data;

    setStep('switching-chain');
    const currentChainId = walletChainId?.startsWith('0x') ? Number.parseInt(walletChainId, 16) : Number(walletChainId);
    if (currentChainId !== CHAIN_ID) {
      await switchBscChain(CHAIN_ID, providerId ?? undefined);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setStep('executing-contract');
    const nonceHash = keccak256(toBytes(nonce));
    const txHash = await executeClaimContract(
      claimData.chain_amount,
      nonceHash,
      claimData.deadline,
      claimData.signature,
      walletAddress,
      claimData.contract_address,
    );

    setStep('waiting-receipt');
    const receipt = await waitForTransactionReceipt(txHash);
    if (receipt.status === '0x0' || receipt.status === 0) {
      return { success: false, step: 'waiting-receipt', error: 'Transaction reverted on-chain', txHash };
    }

    setStep('confirming-claim');
    await confirm_llax_claim({ claim_id: claimData.claim_id, tx_hash: txHash });

    setStep('success');
    return { success: true, step: 'success', txHash, claimId: claimData.claim_id };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    if (err?.code === 4001) {
      return { success: false, step: 'error', error: 'Transaction cancelled' };
    }
    return { success: false, step: 'error', error: err?.message || 'Unknown error' };
  }
};

export const autoConfirmPendingClaims = async (_walletAddress: string): Promise<void> => {
  try {
    const recordsResponse = await get_llax_claim_records();
    const records: LLAxClaimRecord[] = recordsResponse.data || [];
    const pendingRecords = records.filter(r => r.status === 'pending' && r.tx_hash);

    for (const record of pendingRecords) {
      try {
        const receipt = await executeViaBackgroundScript('eth_getTransactionReceipt', [record.tx_hash]);
        if (
          receipt &&
          ((receipt as { status: unknown }).status === '0x1' || (receipt as { status: unknown }).status === 1)
        ) {
          await confirm_llax_claim({ claim_id: record.id, tx_hash: record.tx_hash });
        }
      } catch {
        // Skip individual failures
      }
    }
  } catch {
    // Silently fail - background operation
  }
};
