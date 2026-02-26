import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { web3Config } from '../matches/all/config/web3';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';

// 创建配置和客户端
const config = web3Config();
const queryClient = new QueryClient();

/**
 * 钱包页面主组件
 * 运行在扩展上下文，可以直接访问 MetaMask
 */
const WalletApp = () => {
  const { isConnected, address, chain } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // 在扩展上下文中，window.ethereum 应该可直接访问
    const checkWallet = () => {
      const hasEthereum = typeof window !== 'undefined' && !!(window as any).ethereum;
      setHasWallet(hasEthereum);
      console.log('[Wallet App] Ethereum detected:', hasEthereum);
    };

    checkWallet();

    // 监听钱包变化
    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[Wallet App] Accounts changed:', accounts);
      if (accounts.length === 0) {
        notifyParent('WALLET_DISCONNECTED', {});
      } else {
        notifyParent('WALLET_CONNECTED', { address: accounts[0] });
      }
    };

    const ethereum = (window as any).ethereum;
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleConnect = async () => {
    try {
      const connector = connectors[0];
      if (!connector) {
        notifyError('No wallet connector available');
        return;
      }

      console.log('[Wallet App] Connecting with connector:', connector);
      await connect({ connector });
    } catch (err) {
      console.error('[Wallet App] Connection error:', err);
      notifyError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      notifyParent('WALLET_DISCONNECTED', {});
    } catch (err) {
      console.error('[Wallet App] Disconnect error:', err);
    }
  };

  // 通知父窗口（Content Script）
  const notifyParent = (type: string, data: any) => {
    if (window.parent !== window) {
      window.parent.postMessage({ type, data }, '*');
      console.log('[Wallet App] Notified parent:', type, data);
    }
  };

  const notifyError = (error: string) => {
    notifyParent('WALLET_ERROR', { error });
  };

  // 已连接状态
  if (isConnected && address) {
    return (
      <div
        style={{
          padding: '40px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f9fafb',
        }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
          {/* 成功图标 */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#10b981',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '40px',
                fontWeight: 'bold',
              }}>
              ✓
            </div>
          </div>

          {/* 标题 */}
          <h2
            style={{
              textAlign: 'center',
              marginBottom: '10px',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111827',
            }}>
            已连接钱包
          </h2>

          {/* 地址 */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid #e5e7eb',
            }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>钱包地址</p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', wordBreak: 'break-all' }}>
              {address.slice(0, 10)}...{address.slice(-8)}
            </p>
          </div>

          {/* 网络 */}
          {chain && (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid #e5e7eb',
              }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>网络</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{chain.name}</p>
            </div>
          )}

          {/* 断开按钮 */}
          <button
            onClick={handleDisconnect}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ef4444')}>
            断开连接
          </button>

          {/* 关闭按钮 */}
          <button
            onClick={() => notifyParent('WALLET_CLOSE', {})}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'white',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '12px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  // 未连接状态
  return (
    <div
      style={{
        padding: '40px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
      }}>
      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '32px',
              fontWeight: 'bold',
            }}>
            W3
          </div>
        </div>

        {/* 标题 */}
        <h2
          style={{ textAlign: 'center', marginBottom: '10px', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
          Web3 钱包连接
        </h2>
        <p style={{ textAlign: 'center', marginBottom: '30px', fontSize: '14px', color: '#6b7280' }}>
          连接您的钱包以访问应用
        </p>

        {/* 钱包检测状态 */}
        {!hasWallet ? (
          <div
            style={{
              backgroundColor: '#fef3c7',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid #fbbf24',
            }}>
            <p
              style={{
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: '#92400e',
                marginBottom: '12px',
              }}>
              未检测到钱包
            </p>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#b45309', marginBottom: '16px' }}>
              请安装 MetaMask 或其他 Web3 钱包
            </p>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
              }}>
              安装 MetaMask
            </a>
          </div>
        ) : (
          // 连接按钮
          <button
            onClick={handleConnect}
            disabled={isPending}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              marginBottom: '20px',
            }}
            onMouseEnter={e => !isPending && (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            {isPending ? '连接中...' : '连接 MetaMask'}
          </button>
        )}

        {/* 错误提示 */}
        {connectError && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              border: '1px solid #fca5a5',
            }}>
            <p
              style={{
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: '#991b1b',
                marginBottom: '4px',
              }}>
              连接失败
            </p>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#b91c1c' }}>{connectError.message}</p>
          </div>
        )}

        {/* 支持的钱包 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#f97316',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            }}>
            MM
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            }}>
            WC
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#8b5cf6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            }}>
            CB
          </div>
        </div>

        {/* 说明 */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #bfdbfe',
          }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>
            由 Wagmi 提供支持
          </p>
          <p style={{ fontSize: '11px', color: '#1e3a8a' }}>使用 MetaMask、Coinbase Wallet 或其他注入钱包连接应用</p>
        </div>
      </div>
    </div>
  );
};

// Provider 包装
export const AppWithProviders = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <WalletApp />
    </QueryClientProvider>
  </WagmiProvider>
);
