import { Button, Copy } from '@src/ui';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@src/store';
import { useEffect, useMemo, useState } from 'react';
import { user_rewardpoints } from '@src/api/user';
import { get_llax_balance, type LLAxBalanceData } from '@src/api/agent_c';
import { useI18n } from '@src/lib/i18n';
import { syncPoints } from '@src/store/slices/userSlice';

// 地址掩码格式化函数
const formatAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export const LoginPanel = ({ onLogout }: { onLogout?: () => void }) => {
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

  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(syncPoints());
    get_llax_balance()
      .then(response => {
        setLlaxBalance(response.data?.balance ?? null);
      })
      .catch(() => {
        setLlaxBalance(null);
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
              </div>
              <div className="font-bold text-black">
                {llaxBalance === null ? '0' : llaxBalance.balance.toLocaleString()}
              </div>
              <Button>Claim</Button>
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
