# Web3 Wallet Integration Architecture

## Problem and Solution

### Problem
Chrome Extension Content Scripts run in an isolated world and cannot directly access `window.ethereum` (injected by MetaMask). Previous attempts using:
1. **IFRAME with wallet.html** - Failed because IFRAMEs in extension context don't have access to page context
2. **Direct script injection** - Failed because it violates CSP (Content Security Policy) with inline scripts

### Solution: Background Script + chrome.scripting.executeScript

The Content Script communicates with the Background Script, which uses `chrome.scripting.executeScript` to execute code in the page's main context where `window.ethereum` is available.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Web Page (x.com)                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Page Main World Context                        │  │
│  │  - window.ethereum (MetaMask) ✅                          │  │
│  │  - Background Script executes code here                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▲                                       │
│                           │ chrome.scripting.executeScript        │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Background Service Worker                      │  │
│  │  - Receives WEB3_REQUEST messages                        │  │
│  │  - Has sender.tab.id ✅                                  │  │
│  │  - Can execute code in page context                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▲                                       │
│                           │ chrome.runtime.sendMessage           │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            Content Script (Isolated World)                │  │
│  │  - React App (App.tsx, Login.tsx)                         │  │
│  │  - executeViaBackgroundScript()                          │  │
│  │  - Cannot access window.ethereum directly                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Works

1. **Content Script → Background Script**
   - Content Script uses `chrome.runtime.sendMessage()`
   - **sender.tab is available** ✅ (because Content Script runs in a webpage tab)
   - Unlike the IFRAME approach where sender.tab was undefined

2. **Background Script → Page Context**
   - Uses `chrome.scripting.executeScript()` with `target: { tabId }`
   - Executes function in the page's main world
   - Has access to `window.ethereum` ✅

3. **Avoids CSP Issues**
   - No inline scripts with `textContent`
   - Background Script's function code is serialized and executed by Chrome
   - Doesn't violate Content Security Policy

## Implementation Details

### 1. Content Script: `executeViaBackgroundScript`

```typescript
const executeViaBackgroundScript = async (method: string, args: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'WEB3_REQUEST',
        method,
        args,
      },
      (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else if (response?.success) {
          resolve(response.result);
        } else {
          reject(new Error('Invalid response'));
        }
      }
    );
  });
};
```

### 2. Background Script: Message Handler

```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'WEB3_REQUEST') {
    handleWeb3Request(request, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // 异步响应
  }
  return false;
});
```

### 3. Background Script: Execute in Page Context

```typescript
async function handleWeb3Request(request: any, sender: chrome.runtime.MessageSender) {
  const { method, args = [] } = request;
  const tabId = sender.tab?.id;

  if (!tabId) {
    throw new Error('No tab ID found');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (methodName: string, methodArgs: any[]) => {
      // 这段代码运行在页面主上下文！
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No ethereum provider found');
      }

      if (typeof window.ethereum[methodName] !== 'function') {
        if (methodName === 'isMetaMask') {
          return !!window.ethereum.isMetaMask;
        }
        return window.ethereum[methodName];
      }

      return window.ethereum[methodName](...methodArgs);
    },
    args: [method, args],
  });

  if (results && results[0] && results[0].result !== undefined) {
    return { success: true, result: results[0].result };
  }

  throw new Error('Execution failed');
}
```

### 4. Wallet Detection

```typescript
const checkPageContextWallet = async (): Promise<boolean> => {
  try {
    const hasWallet = await executeViaBackgroundScript('isMetaMask', []);
    return hasWallet;
  } catch (error) {
    console.error('[App] Failed to check wallet:', error);
    return false;
  }
};
```

### 5. Wallet Connection

```typescript
const connectPageContextWallet = async (): Promise<string> => {
  try {
    const accounts = await executeViaBackgroundScript('eth_requestAccounts', []);

    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    throw new Error('No accounts returned');
  } catch (error) {
    console.error('[App] Failed to connect wallet:', error);
    throw error;
  }
};
```

## Communication Flow

1. **User clicks "Connect Wallet"** in Login component
2. **Login.tsx** calls `onConnect()` prop (from App.tsx)
3. **App.tsx** calls `handleConnectWallet()`
4. **handleConnectWallet()** calls `checkPageContextWallet()`
5. **executeViaBackgroundScript** sends message to Background Script
6. **Background Script** receives message with `sender.tab.id` ✅
7. **Background Script** uses `chrome.scripting.executeScript` to execute code in page context
8. **Injected code** accesses `window.ethereum.isMetaMask` in main world ✅
9. **Result returned** to Background Script
10. **Background Script** sends response back to Content Script
11. **If wallet found**, calls `connectPageContextWallet()`
12. **MetaMask prompt** appears (user approval)
13. **Accounts returned** via Background Script
14. **State updated** and UI shows connected address

## Key Files

- `pages/content-ui/src/matches/all/App.tsx` - Content Script with wallet logic
- `pages/content-ui/src/matches/all/components/Login.tsx` - Login UI component
- `chrome-extension/src/background/index.ts` - Background script (Web3 request handler)

## Testing

1. Open `test-wallet.html` in browser with MetaMask installed
2. Test each button to verify MetaMask is accessible
3. Load extension and test on x.com or any website

## Benefits of This Approach

✅ Works on all websites (no CSP violations)
✅ Direct access to MetaMask in page context via Background Script
✅ Clean separation of concerns
✅ Reliable message passing with chrome.runtime
✅ Full MetaMask functionality available
✅ No inline scripts (CSP compliant)

## Comparison with Previous Approaches

| Approach | sender.tab Available? | CSP Compliant? | Works? |
|----------|----------------------|----------------|--------|
| IFRAME + Background Script | ❌ (IFRAME has no tab) | ✅ | ❌ Failed |
| Direct Script Injection | N/A | ❌ (inline scripts) | ❌ Failed |
| **Content Script + Background Script** | ✅ | ✅ | ✅ **Works** |

## Future Enhancements

- Add support for wallet switching detection
- Add support for network switching
- Add support for signing transactions
- Add support for EIP-712 typed data signing
- Add support for multiple wallets (Coinbase, WalletConnect, etc.)
