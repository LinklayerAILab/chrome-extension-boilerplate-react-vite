import { useState, useEffect, useMemo } from 'react';
import { store } from '@src/store';
import type { BinanceTokenScreenItem } from '@src/api/agent_c';
import { getBinanceTokenScreen } from '@src/api/agent_c';
import { setSelectedMenuId, setSidePanelOpen } from '@src/store/slices/uiSlice';
import { setTokenList } from '@src/store/slices/tokenSlice';
import { StatusIndicator } from './StatusIndicator';
// 检测 Twitter/X 平台的主题

const parseRgb = (value: string): { r: number; g: number; b: number; a: number } | null => {
  const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(',').map(part => part.trim());
  if (parts.length < 3) return null;
  const r = Number.parseFloat(parts[0]);
  const g = Number.parseFloat(parts[1]);
  const b = Number.parseFloat(parts[2]);
  const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
  if ([r, g, b, a].some(v => Number.isNaN(v))) return null;
  return { r, g, b, a };
};

const parseHex = (value: string): { r: number; g: number; b: number; a: number } | null => {
  const hex = value.replace('#', '').trim();
  if (![3, 6, 8].includes(hex.length)) return null;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(ch => ch + ch)
          .join('')
      : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const a = full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b, a].some(v => Number.isNaN(v))) return null;
  return { r, g, b, a };
};

const colorToRgb = (value: string): { r: number; g: number; b: number; a: number } | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (normalized.startsWith('#')) return parseHex(normalized);
  if (normalized.startsWith('rgb')) return parseRgb(normalized);
  if (/^\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*\d*\.?\d+)?\s*$/.test(normalized)) {
    return parseRgb(`rgb(${normalized})`);
  }
  return null;
};

const isTransparent = (value: string) => {
  const rgb = colorToRgb(value);
  return rgb ? rgb.a === 0 : true;
};

const getLuminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const readCssVarColor = (el: Element, varNames: string[]) => {
  const style = window.getComputedStyle(el);
  for (const name of varNames) {
    const value = style.getPropertyValue(name).trim();
    if (!value) continue;
    const rgb = colorToRgb(value);
    if (rgb && rgb.a > 0) return rgb;
  }
  return null;
};

const pickThemeFromElement = (el: Element | null): 'light' | 'dark' | null => {
  if (!el) return null;
  const style = window.getComputedStyle(el);
  const bg = style.backgroundColor;
  if (!bg || isTransparent(bg)) return null;
  const rgb = colorToRgb(bg);
  if (!rgb) return null;
  const luminance = getLuminance(rgb);
  return luminance < 0.35 ? 'dark' : 'light';
};

const getSystemTheme = (): 'light' | 'dark' => {
  // ??? Twitter/X ? DOM ?????
  try {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    // Prefer CSS variables if present (X sets theme colors via CSS variables)
    const varNames = ['--background', '--background-rgb', '--app-background', '--surface-color'];
    const varRgb =
      readCssVarColor(htmlElement, varNames) || (bodyElement ? readCssVarColor(bodyElement, varNames) : null);
    if (varRgb) {
      const luminance = getLuminance(varRgb);
      const theme = luminance < 0.35 ? 'dark' : 'light';
      console.log('[Theme Detection] Theme detected via CSS variables:', theme);
      return theme;
    }

    // Check real container backgrounds (X often renders on nested containers, not body)
    const containerCandidates = [
      document.querySelector('#react-root'),
      document.querySelector('main'),
      document.querySelector('[data-testid="primaryColumn"]'),
      document.querySelector('[data-testid="sidebarColumn"]'),
      document.querySelector('[role="main"]'),
      document.querySelector('body'),
      document.querySelector('html'),
    ].filter(Boolean) as Element[];

    for (const el of containerCandidates) {
      const theme = pickThemeFromElement(el);
      if (theme) {
        console.log('[Theme Detection] Theme detected via container background:', theme);
        return theme;
      }
    }

    // ?? HTML ???? data-theme ??????????
    const dataTheme = htmlElement.getAttribute('data-theme');
    if (dataTheme === 'dark') {
      console.log('[Theme Detection] Dark theme detected via data-theme attribute');
      return 'dark';
    } else if (dataTheme === 'light') {
      console.log('[Theme Detection] Light theme detected via data-theme attribute');
      return 'light';
    }

    // ?? body ? html ?????
    if (
      document.body.classList.contains('theme-dark') ||
      document.body.classList.contains('dark') ||
      htmlElement.classList.contains('theme-dark') ||
      htmlElement.classList.contains('dark')
    ) {
      console.log('[Theme Detection] Dark theme detected via class name');
      return 'dark';
    }

    // ?? meta theme-color????????
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const themeColor = themeMeta.getAttribute('content');
      if (themeColor && themeColor.startsWith('#')) {
        const rgb = colorToRgb(themeColor);
        if (rgb && getLuminance(rgb) < 0.35) {
          console.log('[Theme Detection] Dark theme detected via theme-color meta:', themeColor);
          return 'dark';
        }
      }
    }

    // Fallback to system theme
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('[Theme Detection] Fallback to system theme, dark:', systemDark);
    return systemDark ? 'dark' : 'light';
  } catch (error) {
    console.warn('[Theme Detection] Error detecting theme, falling back to system theme:', error);
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemDark ? 'dark' : 'light';
  }
};
// Logo 文件路径
const lightLogo = chrome.runtime.getURL('content-ui/xInject/light-logo.svg');
const darkLogo = chrome.runtime.getURL('content-ui/xInject/dark-logo.svg');
const listTop = chrome.runtime.getURL('content-ui/xInject/listTop.svg');
const coin = chrome.runtime.getURL('content-ui/xInject/coin.svg');
const topDark = chrome.runtime.getURL('content-ui/xInject/top-dark.svg');
const topLight = chrome.runtime.getURL('content-ui/xInject/top-light.svg');
const greenDark = chrome.runtime.getURL('content-ui/xInject/green-dark.svg');
const greenLight = chrome.runtime.getURL('content-ui/xInject/green-light.svg');
const defaultTokenLogo = chrome.runtime.getURL('content-ui/coins/bnb.svg');

// 注入组件专用样式
const injectStyles = (lightBgImage: string, darkBgImage: string) => {
  const styleId = 'x-platform-injected-styles';
  const existingStyle = document.getElementById(styleId);

  // 如果已存在，先移除再重新注入（因为背景图 URL 可能变化）
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .x-platform-container {
      padding: 12px 14px;
      margin: 0 0 14px;
      border-radius: 12px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s;
    }

    .x-platform-container.light {
      background-color: rgb(255, 255, 255);
      border: 1px solid #Eeee;
    }

    .x-platform-container.dark {
      background-color: #1B1B1B;
    }

    .x-platform-container.light:hover {
      background-color: rgba(255, 255, 255, 0.8);
    }

    .x-platform-container.dark:hover {
      background-color: rgb(19, 18, 18);
    }

    .x-platform-content {
      color: #000000;
    }

    .x-platform-container.dark .x-platform-content {
      color: #CCCCCC;
    }

    .x-platform-logo img {
      height: 36px;
      object-fit: contain;
    }

    .x-platform-token-card {
      border-radius: 12px;
      padding: 8px;
      margin-top: 10px;
    }

    .x-platform-token-card.light {
      background-color: #ccff00;
    }

    .x-platform-token-card.dark {
      background-color: #2E3A21;
    }

    .x-platform-token-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      font-weight: bold;
      font-size: 14px;
    }
      .x-platform-token-chart-container {
        padding: 12px 14px;
        border-radius: 8px;
      }
    .x-platform-token-chart-container.dark{
      background-color: #181818;
     }
          .x-platform-token-chart-container.light{
      background-color: white;
     }
    .x-platform-token-chart {
      height: 115px;
      border-radius: 8px;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
    }

    .x-platform-token-chart.light {
      background-image: url('${lightBgImage}');
    }

    .x-platform-token-chart.dark {
      background-image: url('${darkBgImage}');
    }

    .x-platform-list-card {
        height: 68px;
        border-radius:8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px 0 14px;
      }
    .x-platform-list-card.light {
      background-color: #ccff00;
    }
     .x-platform-list-card.dark {
      background-color: #2E3A21;
    }

    .x-platform-list-card-title {
      font-size: 14px;
      font-weight: bold;
      margin:0 5px;
    }
    .x-platform-list-card-title.light {
 
      color: black;
    }
    .x-platform-list-card-title.dark {

      color: white;
    }

    .x-platform-list-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }

    .x-platform-list-section {
      margin-top: 14px;
    }
    .inject-X-list-card{
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
    }
    .inject-X-list-card.light{
      background-color: white;
      border: 1px solid #E6E6E6;
    }
    .inject-X-list-card.light:hover{
      background-color: #E6E6E6;
    }
    .inject-X-list-card.dark{
      background-color: #2D2D2D;
    }
    .inject-X-list-card.dark:hover{
      background-color: #1B1B1B;
    }
    .inject-X-list-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      font-weight: bold;
    }
    .inject-X-list-card-bottom {
      display: flex;
      align-items: center;
      margin-top: 14px;
    }
    .inject-X-list-card-bottom-left, .inject-X-list-card-bottom-right {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .inject-X-list-card-bottom-left.dark,.inject-X-list-card-bottom-right.dark{
      height: 24px;
      border-radius: 15px;
      border: 1px solid #F9FFE2;
      color: #F9FFE2;
      text-align: center;
      width: 135px;
      line-height: 24px;
      background-color: #000000;
    }
    .inject-X-list-card-bottom-left.light,.inject-X-list-card-bottom-right.light{
      height: 24px;
      border-radius: 15px;
      border: 1px solid #789600;
      color: #789600;
      text-align: center;
      width: 135px;
      line-height: 24px;
      background-color: white;
    }
  .inject-X-list-card-top-coin {
    display: flex;
    align-items: center;
    gap: 4px;
  }
     .inject-X-list-card-top-coin img {
      width:24px;
      height:24px;
      border-radius:100%;
      background:white;
     }
  .inject-X-list-card-top-status{
    display: flex;
    align-items: center;
     gap: 4px;
  }
  .inject-X-list-card-top-status-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
  .inject-X-list-card-top-status-indicator.light {
    background: linear-gradient(to bottom, #A7FFD5 21%, #51FF6E 100%);
    border: 1px solid #E6E6E6;
  }
  .inject-X-list-card-top-status-indicator.dark {
    background: linear-gradient(to bottom, #A7FFD5 21%, #51FF6E 100%);
    border: 1px solid #fff;
  }
  .inject-X-list-card-top-status-indicator-fill {
   border: 1px solid #000000;
   width: 18px;
   height: 18px;
   border-radius: 50%;
   }
   .x-platform-inject-go {
    border:2px solid #000000;
    border-radius: 8px;
    background-color: #cf0;
    margin-top: 14px;
     font-weight: bold;
     font-size: 14px;
     color: #000000;
     justify-content: space-between;
     display: flex;
     align-items: center;
     padding: 12px;
   }
     .x-platform-token-chart-top {
     display: flex;
     justify-content: space-between;
     gap:60px;
     margin-top: 4px;

     }
     .x-platform-token-chart-bottom{
      display: flex;
     justify-content: space-between;
     margin-top: 8px;
      gap:60px;
      margin-top: 10px;
     }
      .x-platform-token-header-logo{
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
      gap: 4px;
      width: 100%;
      }
      .x-platform-list-card-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 0 5px;
      color: #666666;
     }
      .x-platform-token-header-logo.light{
        text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;
                color: black;
      }
      .x-platform-token-header-logo.dark{
        text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;
        color: black;
      }

     .x-platform-token-chart-top>div, .x-platform-token-chart-bottom>div {
      flex: 1;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      
     }
      .x-platform-token-chart-top-label,x-platform-token-chart-bottom-label, .x-platform-token-chart-bottom-value,.x-platform-token-chart-top-value {
        text-align: center;
      }
      .x-platform-token-chart-top-label,.x-platform-token-chart-bottom-label{
        font-size: 10px;

      }
        .x-platform-token-chart-top-value,.x-platform-token-chart-bottom-value{
        font-size: 13px;
        font-weight: bold;

      }

  @keyframes injectStatusBlinkLight {
    0%, 60% {
      background: linear-gradient(to bottom, #A7FFD5, #51FF6E);
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px #E6E6E6;
    }
    65% {
      background: #eee;
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px #E6E6E6;
    }
    70%, 85% {
      background: #eee;
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 3px #E6E6E6, 0 0 6px rgba(167, 255, 213, 0.6);
    }
    90%, 100% {
      background: linear-gradient(to bottom, #A7FFD5, #51FF6E);
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px #E6E6E6;
    }
  }

  @keyframes injectStatusBlinkDark {
    0%, 60% {
      background: linear-gradient(to bottom, #A7FFD5, #51FF6E);
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px rgba(27, 27, 27, 0.6);
    }
    65% {
      background: #333;
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px rgba(27, 27, 27, 0.6);
    }
    70%, 85% {
      background: #333;
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 3px rgba(27, 27, 27, 0.6), 0 0 6px rgba(167, 255, 213, 0.6);
    }
    90%, 100% {
      background: linear-gradient(to bottom, #A7FFD5, #51FF6E);
      box-shadow: inset 0 2px 0 0 #fff, 0 0 0 2px rgba(27, 27, 27, 0.6);
    }
  }
  `;

  document.head.appendChild(style);
};

// X 平台 React 组件
export const XPlatformComponent = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getSystemTheme);
  const [tokens, setTokens] = useState<BinanceTokenScreenItem[]>(() => store.getState().tokens.tokenList);

  useEffect(() => {
    const updateTheme = () => setTheme(getSystemTheme());

    // ????? URL
    const lightBgImage = chrome.runtime.getURL('content-ui/xInject/bsc-light-bg.svg');
    const darkBgImage = chrome.runtime.getURL('content-ui/xInject/bsc-dark-bg.svg');

    // ???????????
    injectStyles(lightBgImage, darkBgImage);
    updateTheme();

    const observerTargets: Element[] = [document.documentElement];
    if (document.body) observerTargets.push(document.body);
    const reactRoot = document.querySelector('#react-root');
    if (reactRoot) observerTargets.push(reactRoot);

    const observer = new MutationObserver(() => updateTheme());
    for (const target of observerTargets) {
      observer.observe(target, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }

    // ????????????
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      updateTheme();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTokens(store.getState().tokens.tokenList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchTokens = async () => {
      try {
        const screenResponse = await getBinanceTokenScreen();
        const tokenList = screenResponse.data?.results ?? [];
        if (isActive) {
          store.dispatch(setTokenList(tokenList));
        }
      } catch (error) {
        console.error('Failed to load token list:', error);
        if (isActive) {
          store.dispatch(setTokenList([]));
        }
      }
    };

    fetchTokens();
    return () => {
      isActive = false;
    };
  }, []);

  const themeClass = theme === 'light' ? 'light' : 'dark';

  return (
    <>
      <div
        className={`x-platform-container ${themeClass}`}
        onClick={() => {
          console.log('[XPlatform] Component clicked, current theme:', theme);
          // 添加点击事件处理逻辑
        }}>
        <div className="x-platform-content">
          <div id="x-inject-logo" className="x-platform-logo">
            <img style={{ height: 20 }} src={theme === 'dark' ? darkLogo : lightLogo} alt="X Logo" />
          </div>
          <div className={`x-platform-token-card ${themeClass}`}>
            <div className="x-platform-token-header">
              <div className={`x-platform-token-header-logo ${themeClass}`}>
                <img src={chrome.runtime.getURL('content-ui/xInject/bnb.svg')} alt="BNB" />
                <span>BSC Chain Pulse</span>
              </div>
            </div>
            <div className={`x-platform-token-chart-container ${themeClass}`}>
              <div className={`x-platform-token-chart relative ${themeClass}`}>
                {theme === 'light' ? (
                  <img
                    src={greenLight}
                    alt="Green Light"
                    style={{ position: 'absolute', width: 60, height: 76, left: '50%', marginLeft: -32, top: '20px' }}
                  />
                ) : (
                  <img
                    src={greenDark}
                    alt="Green Dark"
                    style={{ position: 'absolute', width: 60, height: 76, left: '50%', marginLeft: -32, top: '20px' }}
                  />
                )}
                <div className="x-platform-token-chart-top">
                  <div>
                    <div className="x-platform-token-chart-top-label">Healthy Token</div>
                    <div className="x-platform-token-chart-top-value">{tokens.length}</div>
                  </div>
                  <div>
                    <div className="x-platform-token-chart-top-label">Active Pools</div>
                    <div className="x-platform-token-chart-top-value">-</div>
                  </div>
                </div>
                <div className="x-platform-token-chart-bottom">
                  <div>
                    <div className="x-platform-token-chart-bottom-label">Total Liquidity</div>
                    <div className="x-platform-token-chart-bottom-value">-</div>
                  </div>
                  <div>
                    <div className="x-platform-token-chart-bottom-label">Avg Exit Cost</div>
                    <div className="x-platform-token-chart-bottom-value">-</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`x-platform-container x-platform-list-section ${themeClass}`}>
        <div className="x-platform-content">
          <div className={`x-platform-list-card ${themeClass}`}>
            <div>
              <div className={`x-platform-list-card-title ${themeClass}`} style={{ fontSize: 16 }}>
                BSC Blue-Chips
              </div>
              <div className={`x-platform-list-card-time`}>update 3m ago</div>
            </div>
            <div>
              <img src={listTop} alt="List Top" />
            </div>
          </div>
          <div className="x-platform-list-content">
            {tokens.slice(0, 5).map(token => (
              <InjectXListCard
                key={token.contractAddress || token.tokenId}
                theme={theme}
                logo={token.imageUrl || defaultTokenLogo}
                name={token.tokenSymbol}
              />
            ))}
          </div>
          <div
            className="x-platform-inject-go"
            onClick={() => {
              // 打开侧边栏，与浮动按钮逻辑相同
              store.dispatch(setSidePanelOpen(true));
              store.dispatch(setSelectedMenuId(7));
            }}>
            <div>View More Details</div>
            <div>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="25.2741" height="25.2741" rx="12.637" fill="white" />
                <rect x="1" y="1" width="25.2741" height="25.2741" rx="12.637" stroke="black" stroke-width="2" />
                <path
                  d="M9.375 17.8991L17.8981 9.37598M17.8981 9.37598H9.375M17.8981 9.37598V17.8991"
                  stroke="black"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

function InjectXListCard({ theme, logo, name }: { theme: 'light' | 'dark'; logo: string; name: string }) {
  const randomDelay = useMemo(() => (Math.random() * 1 + 0.5).toFixed(2), []);
  const randomDuration = useMemo(() => (Math.random() * 1.2 + 3.2).toFixed(2), []);
  return (
    <div className={`inject-X-list-card ${theme === 'light' ? 'light' : 'dark'}`}>
      <div className="inject-X-list-card-top">
        <div className="inject-X-list-card-top-coin">
          <img src={logo} alt="" />
          {name.toUpperCase()}
        </div>
        <div className="inject-X-list-card-top-status" style={{ fontWeight: 'bold' }}>
          <div
            className={`inject-X-list-card-top-status-indicator ${theme === 'light' ? 'light' : 'dark'}`}
            style={{
              animation: `${theme === 'light' ? 'injectStatusBlinkLight' : 'injectStatusBlinkDark'} ${randomDuration}s ease-in-out ${randomDelay}s infinite`,
            }}>
            <div className="inject-X-list-card-top-status-indicator-fill"></div>
            {/* <StatusIndicator size={12} borderWidth={1}></StatusIndicator> */}
          </div>
          Optimal
        </div>
      </div>
      <div className="inject-X-list-card-bottom flex items-center justify-between">
        <div className={`inject-X-list-card-bottom-left ${theme}`}>
          LP Depth
          {theme === 'light' ? (
            <img src={topLight} alt="Top Light" style={{ marginLeft: '6px', width: 7 }} />
          ) : (
            <img src={topDark} alt="Top Dark" style={{ marginLeft: '6px', width: 7 }} />
          )}
        </div>
        <div className={`inject-X-list-card-bottom-right ${theme}`}>
          LP Stability
          {theme === 'light' ? (
            <img src={topLight} alt="Top Light" style={{ marginLeft: '6px', width: 7 }} />
          ) : (
            <img src={topDark} alt="Top Dark" style={{ marginLeft: '6px', width: 7 }} />
          )}
        </div>
      </div>
    </div>
  );
}
