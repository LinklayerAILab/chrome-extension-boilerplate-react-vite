# Web3 Wallet Integration - Testing Guide

## Changes Made

### 1. New Architecture
- **Removed**: IFRAME + Background Script approach (didn't work because IFRAMEs don't have tab context)
- **Implemented**: Direct page context script injection from Content Script
- **Files Modified**:
  - `pages/content-ui/src/matches/all/App.tsx` - Added wallet detection and connection functions
  - `pages/content-ui/src/matches/all/components/Login.tsx` - Updated to use direct connection
  - `chrome-extension/src/background/index.ts` - Removed Web3 request handler

### 2. Files Removed
- `pages/content-ui/public/wallet.html` - No longer needed
- `pages/content-ui/public/wallet.js` - No longer needed
- `pages/content-ui/src/matches/all/components/WalletIFrame.tsx` - No longer needed
- `pages/content-ui/src/matches/all/components/WalletPopup.tsx` - No longer needed

### 3. New Files
- `WALLET_ARCHITECTURE.md` - Detailed architecture documentation
- `test-wallet.html` - Standalone test page for MetaMask

## How to Test

### Option 1: Using Test Page (Recommended First Step)

1. **Install MetaMask** if you haven't already
   - https://metamask.io/

2. **Open test page** in browser:
   ```bash
   # In browser, open:
   file:///D:/Job/GithubOpenSources/chrome-extension-boilerplate-react-vite/test-wallet.html
   ```

3. **Test each button**:
   - "Check Wallet" - Should detect MetaMask ✅
   - "Connect Wallet" - Should prompt for approval ✅
   - "Get Chain ID" - Should return current network ✅

### Option 2: Using Extension on x.com

1. **Build the extension**:
   ```bash
   pnpm dev
   ```

2. **Load extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/` folder

3. **Test on x.com**:
   - Go to https://x.com
   - You should see the injected side panel appear
   - Click "Connect Wallet"
   - MetaMask popup should appear
   - Approve connection
   - Address should display in the side panel

## How It Works

```
User clicks "Connect Wallet"
  ↓
Login.tsx calls onConnect()
  ↓
App.tsx handleConnectWallet()
  ↓
checkPageContextWallet()
  ↓
Script injected into page context
  ↓
Checks window.ethereum.isMetaMask
  ↓
Result via postMessage
  ↓
If found, connectPageContextWallet()
  ↓
MetaMask approval prompt
  ↓
Address returned to Content Script
  ↓
State updated, UI shows address
```

## Troubleshooting

### "未检测到 MetaMask"
- Make sure MetaMask is installed
- Make sure MetaMask is unlocked
- Refresh the page and try again

### "No ethereum provider found"
- Check browser console for errors
- Make sure you're on a website (not chrome:// URL)
- Try opening test-wallet.html to verify MetaMask works

### No UI appearing on x.com
- Check browser console for errors
- Make sure extension is loaded and enabled
- Refresh the x.com page

## Debugging

Open browser console (F12) and look for:
- `[App]` - Content Script logs
- `[Page Context]` - Injected script logs
- `[Login]` - Login component logs

## Next Steps

Once wallet connection is working:
1. Add wallet switching detection
2. Add network switching detection
3. Add transaction signing
4. Add support for multiple wallets

See `WALLET_ARCHITECTURE.md` for more details.
