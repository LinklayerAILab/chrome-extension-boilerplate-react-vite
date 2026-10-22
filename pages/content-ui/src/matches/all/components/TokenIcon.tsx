import { memo, useEffect, useState } from 'react';

interface TokenIconProps {
  /** 代币图标 URL（GuardToken.image_url），为空或加载失败时回退首字母圆 */
  src?: string;
  symbol: string;
  size?: number;
  /** 关注列表卡片样式：外围 2px 黑色圆环 + 环内 2px 内边距（添加关注列表不启用） */
  bordered?: boolean;
}

/** 代币图标：图片 + 首字母回退（参考 CoinList 的 CoinImage 模式） */
export const TokenIcon = memo(({ src, symbol, size = 24, bordered = false }: TokenIconProps) => {
  const [failed, setFailed] = useState(false);

  // 列表复用时 src 变化需重置失败态
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showFallback = !src || failed;

  if (!bordered) {
    if (showFallback) {
      return (
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-black font-bold text-white"
          style={{ width: size, height: size, fontSize: Math.max(10, size / 2) }}>
          {symbol.slice(0, 1).toUpperCase()}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={symbol}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  // 关注列表：2px 黑色圆环 + 圈内 2px 内边距（border-box 下外径仍为 size）
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-white p-[2px]"
      style={{ width: size, height: size }}>
      {showFallback ? (
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black font-bold text-white"
          style={{ fontSize: Math.max(10, size / 2) }}>
          {symbol.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <img
          src={src}
          alt={symbol}
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
});

TokenIcon.displayName = 'TokenIcon';
