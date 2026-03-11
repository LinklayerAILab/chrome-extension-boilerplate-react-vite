import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * @prop default_locale
 * if you want to support multiple languages, you can use the following reference
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
 *
 * @prop browser_specific_settings
 * Must be unique to your extension to upload to addons.mozilla.org
 * (you can delete if you only want a chrome extension)
 *
 * @prop permissions
 * Firefox doesn't support sidePanel (It will be deleted in manifest parser)
 *
 * @prop content_scripts
 * css: ['content.css'], // public folder
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: 'LinkLayerAI',
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: 'Unlock Your Live Trading Data, Ignite Trading Social Connections — Powered by Agent Intelligence.',
  host_permissions: ['<all_urls>'],
  permissions: ['storage', 'scripting', 'tabs', 'notifications', 'sidePanel', 'offscreen'],
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_icon: {
      '128': 'icon-128.png',
      '48': 'icon-48.png',
      '64': 'icon-64.png',
      '1500': 'icon-1500.png',
    },
  },
  // chrome_url_overrides: {
  //   newtab: 'new-tab/index.html',
  // },
  icons: {
    '128': 'icon-128.png',
    '48': 'icon-48.png',
    '64': 'icon-64.png',
    '1500': 'icon-1500.png',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content/all.iife.js'],
    },
    {
      matches: ['https://example.com/*'],
      js: ['content/example.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['content-ui/all.iife.js'],
    },
    {
      matches: ['https://example.com/*'],
      js: ['content-ui/example.iife.js'],
    },
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      css: ['content.css'],
    },
  ],
  devtools_page: 'devtools/index.html',
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', '*.html', 'icon-128.png', 'content-ui/*'],
      matches: ['*://*/*'],
    },
  ],
  side_panel: {
    default_path: 'side-panel/index.html',
  },
  sandbox: {
    pages: ['content-ui/turnstile.html'],
  },
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval' http://localhost:* http://127.0.0.1:*; object-src 'self'; frame-src 'self' https://cdn.linklayer.ai",
    sandbox:
      "sandbox allow-scripts allow-forms; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; object-src 'self'",
  },
} satisfies ManifestType;

export default manifest;
