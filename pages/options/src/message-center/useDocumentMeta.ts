import { useEffect } from 'react';
import type { MessageTexts } from './i18n';

interface DocumentMetaOptions {
  /** 当前语言文案 */
  t: MessageTexts;
  /** 列表消息总数；0/未知时标题省略括号部分 */
  count: number;
  /** 已按当前语言格式化好的数量文本（如「1.1K」「12.3万」） */
  totalText: string;
  /**
   * 详情视图当前消息的标题。有值时标签页标题用「消息标题 · LinkLayerAI」，
   * 为 null 时回落到列表页标题。
   */
  detailTitle?: string | null;
}

/**
 * 同步浏览器标签页标题与 <meta name="description">。
 *
 * options 是独立页面（chrome-extension://.../options/index.html），index.html 里
 * 硬编码了 <title>Options</title>；标签页标题和页面描述都需要运行期由当前视图决定，
 * 因此在这里统一写入。
 */
export const useDocumentMeta = ({ t, count, totalText, detailTitle }: DocumentMetaOptions) => {
  // 标题：详情视图用消息标题，列表视图用「全部消息 (N)」
  useEffect(() => {
    if (detailTitle) {
      document.title = t.detailPageTitle(detailTitle);
      return;
    }
    document.title = t.pageTitle(count > 0 ? totalText : undefined);
  }, [t, count, totalText, detailTitle]);

  // 描述：只随语言变化，与消息数量无关
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = t.pageDescription;

    // 只在本次凭空创建时清理，避免误删 index.html 里原本就有的标签
    return () => {
      if (created) meta?.remove();
    };
  }, [t]);
};
