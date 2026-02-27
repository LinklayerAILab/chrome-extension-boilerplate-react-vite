import { useEffect, useState } from 'react';

interface LoginProps {
  onLoginSuccess?: () => void;
  onConnect?: (providerId?: string) => Promise<void>;
  isConnecting?: boolean;
  connectionError?: string | null;
}

type WalletItem = {
  id: string;
  name: string;
  icon: string;
  url?: string;
  installed: boolean;
};

type WalletItemWithSort = WalletItem & { sortIndex: number };

// Helper function to get wallet icon URL
const getWalletIcon = (walletName: string): string => {
  return chrome.runtime.getURL(`content-ui/wallets/${walletName}.svg`);
};

const DEFAULT_WALLETS: WalletItem[] = [
  {
    id: 'binance-0',
    name: 'Binance Wallet',
    icon: getWalletIcon('binance'),
    url: 'https://www.binance.com/en/wallet',
    installed: false,
  },
  // {
  //   id: "okx-0",
  //   name: "OKX Wallet",
  //   icon: getWalletIcon('okx'),
  //   url: "https://www.okx.com/web3",
  //   installed: false,
  // },
  {
    id: 'metamask-0',
    name: 'MetaMask',
    icon: getWalletIcon('metamask'),
    url: 'https://metamask.io/download/',
    installed: false,
  },
  {
    id: 'bitget-0',
    name: 'Bitget Wallet',
    icon: getWalletIcon('bitget'),
    url: 'https://web3.bitget.com/',
    installed: false,
  },
  {
    id: 'coinbase-0',
    name: 'Coinbase Wallet',
    icon: getWalletIcon('coinbase'),
    url: 'https://www.coinbase.com/wallet',
    installed: false,
  },
  {
    id: 'trust-0',
    name: 'Trust Wallet',
    icon: getWalletIcon('trust'),
    url: 'https://trustwallet.com/download',
    installed: false,
  },
  {
    id: 'phantom-0',
    name: 'Phantom',
    icon: getWalletIcon('phantom'),
    url: 'https://phantom.app/download',
    installed: false,
  },
  {
    id: 'rabby-0',
    name: 'Rabby',
    icon: getWalletIcon('rabby'),
    url: 'https://rabby.io/',
    installed: false,
  },
];

export const Login = ({ onLoginSuccess, onConnect, isConnecting = false, connectionError = null }: LoginProps) => {
  const [wallets, setWallets] = useState<WalletItem[]>(DEFAULT_WALLETS);
  const [walletFlags, setWalletFlags] = useState<any>(null);

  useEffect(() => {
    const loadWallets = async () => {
      if (!chrome?.runtime?.sendMessage) {
        setWallets(DEFAULT_WALLETS);
        return;
      }

      try {
        const response = await new Promise<{ success?: boolean; result?: any; error?: string }>(resolve => {
          chrome.runtime.sendMessage(
            {
              type: 'WEB3_REQUEST',
              method: 'getWalletProviders',
              args: [],
            },
            result => resolve(result || {}),
          );
        });

        const detected = Array.isArray(response.result) ? response.result : [];
        const installedIds = new Set(detected.map((item: { id: string }) => item.id));
        const detectedTypes = new Set(
          detected.map((item: { type?: string; id: string }) => item.type || item.id.split('-')[0]),
        );
        const detectedByType = new Map<string, { id: string; type?: string; icon?: string }>();
        detected.forEach((item: { id: string; type?: string; icon?: string }) => {
          const type = item.type || item.id.split('-')[0];
          if (!detectedByType.has(type)) {
            detectedByType.set(type, { id: item.id, type: item.type, icon: item.icon });
          }
        });
        const merged = DEFAULT_WALLETS.map(wallet => {
          const type = wallet.id.split('-')[0];
          const detectedMatch = detectedByType.get(type);
          return {
            ...wallet,
            id: detectedMatch?.id || wallet.id,
            icon: detectedMatch?.icon || wallet.icon,
            installed: installedIds.has(wallet.id) || detectedTypes.has(type),
          };
        });

        const knownTypes = new Set(DEFAULT_WALLETS.map(wallet => wallet.id.split('-')[0]));
        const extra = detected
          .filter((wallet: { id: string; type?: string }) => !knownTypes.has(wallet.type || wallet.id.split('-')[0]))
          .map((wallet: { id: string; name?: string; type?: string; icon?: string }) => ({
            id: wallet.id,
            name: wallet.name || 'Injected Wallet',
            icon: wallet.icon || getWalletIcon(wallet.type || wallet.id.split('-')[0]),
            installed: true,
          }));

        const sorted = [...merged, ...extra]
          .map((wallet, index) => ({ ...wallet, sortIndex: index }))
          .sort((a: WalletItemWithSort, b: WalletItemWithSort) => {
            if (a.installed === b.installed) {
              return a.sortIndex - b.sortIndex;
            }
            return a.installed ? -1 : 1;
          })
          .map(({ sortIndex, ...wallet }) => wallet);

        setWallets(sorted);

        const flagsResponse = await new Promise<{ success?: boolean; result?: any }>(resolve => {
          chrome.runtime.sendMessage(
            {
              type: 'WEB3_REQUEST',
              method: 'getWalletFlags',
              args: [],
            },
            result => resolve(result || {}),
          );
        });
        if (flagsResponse?.success) {
          setWalletFlags(flagsResponse.result);
        }
      } catch (error) {
        console.error('[Login] Failed to load wallets:', error);
        setWallets(DEFAULT_WALLETS);
      }
    };

    loadWallets();
  }, []);

  const handleConnect = async (providerId?: string) => {
    console.log('[Login] Connect wallet clicked:', providerId);

    if (onConnect) {
      await onConnect(providerId);
      onLoginSuccess?.();
    }
  };

  const handleWalletClick = (wallet: WalletItem) => {
    if (wallet.installed) {
      handleConnect(wallet.id);
      return;
    }

    if (wallet.url) {
      window.open(wallet.url, '_blank', 'noopener,noreferrer');
    }
  };

  const banner = chrome.runtime.getURL('content-ui/login/banner.svg');

  return (
    <div className="flex flex-col">
      <div className="flex h-[240px] w-full items-center justify-center bg-[#cf0]">
        <img src={banner} className="h-full w-full object-contain" alt=""></img>
      </div>
      <div
        className="h-[calc(100vh-240px)] w-full overflow-y-auto rounded-lg px-[4vh] py-[2vh]"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#ccc #f1f5f9',
        }}>
        {/* ???? */}
        {/* {connectionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-[15px]">
            <p className="text-center text-sm font-semibold text-red-900">????</p>
            <p className="text-center text-xs text-red-700">{connectionError}</p>
          </div>
        )} */}

        {/* ???? */}
        <div className="flex flex-col gap-[1vh]">
          <div className="mb-[1vh] text-[16px] font-bold">Connect Wallet</div>
          <div className="custom-scrollbar">
            {wallets.map(wallet => (
              <button
                key={wallet.id}
                onClick={() => handleWalletClick(wallet)}
                disabled={Boolean(isConnecting && wallet.installed)}
                className="mb-[10px] flex h-[50px] w-full items-center justify-between rounded-lg bg-[#F2F2F2] px-[14px] text-[13px] font-semibold text-gray-700 transition-all hover:bg-[#E3E3E3] active:bg-[#D0D0D0] disabled:cursor-not-allowed disabled:opacity-60">
                <span className="flex items-center gap-[10px]">
                  <img src={wallet.icon} alt={wallet.name} className="h-[24px] w-[24px] rounded-[6px]" />
                  <span>{wallet.name}</span>
                </span>
                <span className="flex items-center gap-[10px]">
                  <span className={wallet.installed ? 'text-green-600' : 'text-gray-400'}>
                    {wallet.installed ? (
                      <div className="flex h-[2.4vh] items-center justify-center rounded-full bg-[#F3FFEF] px-3 text-[#2EC94C]">
                        Installed
                      </div>
                    ) : (
                      <div className="flex h-[2.4vh] items-center justify-center rounded-full bg-[#FFFFFF] px-3 text-[#2D3BFF]">
                        Install
                      </div>
                    )}
                  </span>
                  <svg
                    className="h-[16px] w-[16px] text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center px-[40px]">
            <div className="text-center text-[13px]">
              By continuing, you are agreeing to Project's{' '}
              <a href="https://www.linklayer.ai/termsOfService" className="text-[#409F23]" target="_black">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://www.linklayer.ai/privacyPolicy" className="text-[#409F23]" target="_black">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
