/**
 * Ethereum Bridge Script
 *
 * 这个脚本运行在页面主上下文（Main World）中
 * 可以直接访问 window.ethereum
 * 通过 postMessage 与 Content Script 通信
 */

(function () {
  'use strict';

  console.log('[Ethereum Bridge] Initializing in page context...');

  // 检查 ethereum 是否存在
  if (typeof window.ethereum === 'undefined') {
    console.warn('[Ethereum Bridge] No ethereum provider found');
    return;
  }

  console.log('[Ethereum Bridge] Ethereum provider found:', {
    isMetaMask: window.ethereum.isMetaMask,
    chainId: window.ethereum.chainId,
    selectedAddress: window.ethereum.selectedAddress,
  });

  // 监听来自 Content Script 的消息
  window.addEventListener('message', async event => {
    // 只接受来自同一窗口的消息
    if (event.source !== window) return;

    const { type, action, id, data } = event.data;

    // 只处理我们自己的消息类型
    if (type !== 'ETHEREUM_BRIDGE_REQUEST') return;

    console.log('[Ethereum Bridge] Received request:', action, data);

    try {
      let result;

      switch (action) {
        case 'check':
          // 检查钱包是否存在
          result = {
            exists: true,
            isMetaMask: !!window.ethereum.isMetaMask,
            chainId: window.ethereum.chainId,
            selectedAddress: window.ethereum.selectedAddress,
            isConnected: window.ethereum.isConnected?.() || false,
          };
          break;

        case 'requestAccounts':
          // 请求连接账户
          result = await window.ethereum.request({ method: 'eth_requestAccounts' });
          break;

        case 'getAccounts':
          // 获取已连接的账户
          result = await window.ethereum.request({ method: 'eth_accounts' });
          break;

        case 'getChainId':
          // 获取当前链 ID
          result = await window.ethereum.request({ method: 'eth_chainId' });
          break;

        case 'signMessage':
          // 签名消息
          result = await window.ethereum.request({
            method: 'personal_sign',
            params: [data.message, data.address],
          });
          break;

        case 'signTransaction':
          // 签名交易
          result = await window.ethereum.request({
            method: 'eth_signTransaction',
            params: [data.transaction],
          });
          break;

        case 'sendTransaction':
          // 发送交易
          result = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [data.transaction],
          });
          break;

        case 'switchChain':
          // 切换网络
          result = await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: data.chainId }],
          });
          break;

        case 'addChain':
          // 添加网络
          result = await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [data.chainConfig],
          });
          break;

        case 'watchAsset':
          // 添加代币到钱包
          result = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC20',
              options: data.asset,
            },
          });
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      console.log('[Ethereum Bridge] Sending response:', id, result);

      // 发送成功响应
      window.postMessage(
        {
          type: 'ETHEREUM_BRIDGE_RESPONSE',
          id,
          success: true,
          result,
        },
        '*',
      );
    } catch (error) {
      console.error('[Ethereum Bridge] Error:', error);

      // 发送错误响应
      window.postMessage(
        {
          type: 'ETHEREUM_BRIDGE_RESPONSE',
          id,
          success: false,
          error: error.message || 'Unknown error',
        },
        '*',
      );
    }
  });

  // 监听 MetaMask 事件并转发给 Content Script
  const forwardEvent = (eventType, data) => {
    console.log('[Ethereum Bridge] Forwarding event:', eventType, data);
    window.postMessage(
      {
        type: 'ETHEREUM_BRIDGE_EVENT',
        event: eventType,
        data,
      },
      '*',
    );
  };

  // 监听账户变化
  if (window.ethereum.on) {
    window.ethereum.on('accountsChanged', accounts => {
      forwardEvent('accountsChanged', { accounts });
    });

    // 监听链变化
    window.ethereum.on('chainChanged', chainId => {
      forwardEvent('chainChanged', { chainId });
    });

    // 监听连接状态
    window.ethereum.on('connect', connectInfo => {
      forwardEvent('connect', connectInfo);
    });

    // 监听断开连接
    window.ethereum.on('disconnect', error => {
      forwardEvent('disconnect', { error: error?.message });
    });
  }

  console.log('[Ethereum Bridge] Initialized successfully');
})();
