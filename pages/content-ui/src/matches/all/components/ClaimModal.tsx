import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@src/lib/i18n';
import { Button, message } from '@src/ui';
import Dialog from './Dialog';
import { executeClaimFlow } from '../lib/claimLlax';
import type { ClaimStep, ClaimFlowResult } from '../lib/claimLlax';
import { get_llax_balance, get_llax_claim_records } from '@src/api/agent_c';
import type { LLAxClaimRecord, LLAxBalanceData } from '@src/api/agent_c';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  walletChainId: string;
  providerId?: string;
  isConnected?: boolean;
  onSuccess?: () => void;
}

const STEP_ORDER: ClaimStep[] = [
  'checking-balance',
  'fetching-nonce',
  'signing-message',
  'submitting-claim',
  'switching-chain',
  'executing-contract',
  'waiting-receipt',
  'confirming-claim',
];

const STEP_I18N_KEYS: Record<string, string> = {
  'checking-balance': 'stepCheckBalance',
  'fetching-nonce': 'stepFetchNonce',
  'signing-message': 'stepSignMessage',
  'submitting-claim': 'stepSubmitClaim',
  'switching-chain': 'stepSwitchChain',
  'executing-contract': 'stepExecuteContract',
  'waiting-receipt': 'stepWaitReceipt',
  'confirming-claim': 'stepConfirmClaim',
  success: 'stepSuccess',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  failed: 'statusFailed',
};

export const ClaimModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletChainId,
  providerId,
  isConnected,
  onSuccess,
}: ClaimModalProps) => {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<ClaimStep>('idle');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimFlowResult | null>(null);
  const [claimRecords, setClaimRecords] = useState<LLAxClaimRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'claim' | 'history'>('claim');
  const [llaxBalance, setLlaxBalance] = useState<LLAxBalanceData['balance'] | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await get_llax_balance();
      setLlaxBalance(res.data?.balance ?? null);
    } catch {
      setLlaxBalance(null);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await get_llax_claim_records();
      setClaimRecords(res.data || []);
    } catch {
      setClaimRecords([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBalance();
      if (activeTab === 'history') {
        fetchRecords();
      }
    }
  }, [isOpen, activeTab, fetchBalance, fetchRecords]);

  const handleClaim = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      message.error(t.claim?.walletRequired ?? 'Please connect your wallet first');
      return;
    }

    setIsClaiming(true);
    setClaimResult(null);

    const result = await executeClaimFlow(walletAddress, walletChainId, providerId, step => {
      setCurrentStep(step);
    });

    setClaimResult(result);
    setIsClaiming(false);

    if (result.success) {
      message.success(t.claim?.claimSuccess ?? 'Claim successful!');
      fetchBalance();
      onSuccess?.();
    } else {
      message.error(result.error || (t.claim?.claimFailed ?? 'Claim failed'));
    }
  }, [isConnected, walletAddress, walletChainId, providerId, t, onSuccess, fetchBalance]);

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = currentStep === 'success' ? 100 : Math.round((stepIndex / STEP_ORDER.length) * 100);
  const availableBalance = llaxBalance ? llaxBalance.balance - (llaxBalance.frozen_amount ?? 0) : 0;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="min-h-[300px]">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-black">{t.claim?.title ?? 'Claim LLAx'}</h3>
          <button
            type="button"
            className="cursor-pointer text-[20px] leading-none text-gray-400 hover:text-gray-600"
            onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div className="mb-3 flex gap-1 rounded-[8px] bg-[#F2F2F2] p-[3px]">
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-[6px] px-3 py-[6px] text-[12px] font-medium transition-colors ${
              activeTab === 'claim' ? 'bg-white text-black shadow-sm' : 'text-[#666]'
            }`}
            onClick={() => setActiveTab('claim')}>
            {t.claim?.title ?? 'Claim'}
          </button>
          <button
            type="button"
            className={`flex-1 cursor-pointer rounded-[6px] px-3 py-[6px] text-[12px] font-medium transition-colors ${
              activeTab === 'history' ? 'bg-white text-black shadow-sm' : 'text-[#666]'
            }`}
            onClick={() => setActiveTab('history')}>
            {t.claim?.historyTitle ?? 'History'}
          </button>
        </div>

        {activeTab === 'claim' ? (
          <div>
            {/* Balance display */}
            <div className="mb-3 rounded-[8px] bg-[#E9FF93] p-3">
              <div className="text-[12px] text-[#666]">LLAx</div>
              <div className="text-[20px] font-bold text-black">{llaxBalance?.balance?.toLocaleString() ?? '0'}</div>
              {(llaxBalance?.frozen_amount ?? 0) > 0 && (
                <div className="mt-1 text-[11px] text-[#999]">
                  Frozen: {llaxBalance!.frozen_amount.toLocaleString()}
                </div>
              )}
              <div className="mt-1 text-[11px] text-[#666]">Available: {availableBalance.toLocaleString()}</div>
            </div>

            {/* Progress indicator */}
            {isClaiming && currentStep !== 'idle' && (
              <div className="mb-3">
                <div className="mb-1 h-[4px] overflow-hidden rounded-full bg-[#F2F2F2]">
                  <div
                    className="h-full rounded-full bg-[#cf0] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-[12px] text-[#666]">
                  {t.claim?.[STEP_I18N_KEYS[currentStep] as keyof typeof t.claim] ?? currentStep}
                </div>
              </div>
            )}

            {/* Result display */}
            {claimResult && (
              <div
                className={`mb-3 rounded-[8px] p-3 text-[12px] ${
                  claimResult.success ? 'bg-[#E9FF93] text-green-800' : 'bg-[#FFE0E0] text-red-700'
                }`}>
                {claimResult.success ? (
                  <div>
                    <div className="font-bold">{t.claim?.stepSuccess ?? 'Claim successful!'}</div>
                    {claimResult.txHash && (
                      <a
                        href={`https://bscscan.com/tx/${claimResult.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-[11px] underline">
                        {t.claim?.viewOnBscScan ?? 'View on BscScan'}
                      </a>
                    )}
                  </div>
                ) : (
                  <div>{claimResult.error}</div>
                )}
              </div>
            )}

            {/* Claim button */}
            <Button
              className="w-full bg-[#cf0] font-bold text-black"
              style={{ background: '#cf0' }}
              onClick={handleClaim}
              disabled={isClaiming || availableBalance <= 0}>
              {isClaiming ? (t.claim?.claiming ?? 'Claiming...') : (t.claim?.claimButton ?? 'Claim Now')}
            </Button>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {claimRecords.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#999]">
                {t.claim?.historyEmpty ?? 'No claim history'}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {claimRecords.map(record => (
                  <div key={record.id} className="rounded-[8px] bg-[#F2F2F2] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-black">{record.amount.toLocaleString()} LLAx</span>
                      <span
                        className={`rounded-full px-2 py-[2px] text-[10px] font-medium ${
                          record.status === 'confirmed'
                            ? 'bg-[#E9FF93] text-green-800'
                            : record.status === 'pending'
                              ? 'bg-[#FFF3CD] text-yellow-800'
                              : 'bg-[#FFE0E0] text-red-700'
                        }`}>
                        {t.claim?.[STATUS_LABELS[record.status] as keyof typeof t.claim] ?? record.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#999]">
                      {new Date(record.created_at).toLocaleDateString()}
                    </div>
                    {record.tx_hash && (
                      <a
                        href={`https://bscscan.com/tx/${record.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-[10px] text-[#666] underline">
                        {record.tx_hash.slice(0, 10)}...{record.tx_hash.slice(-8)}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
