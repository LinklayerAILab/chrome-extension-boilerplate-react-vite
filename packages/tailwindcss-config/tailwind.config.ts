import type { Config } from 'tailwindcss';

// 生成常用的像素值配置
const generateSpacing = (max: number) => {
  return Array.from({ length: max }, (_, i) => i + 1).reduce(
    (acc, i) => {
      acc[`${i}px`] = `${i}px`;
      return acc;
    },
    {} as Record<string, string>,
  );
};

export default {
  content: [],
  theme: {
    extend: {
      // 支持所有像素值的 spacing（用于 padding, margin, gap）
      spacing: {
        ...generateSpacing(600), // 1px 到 600px
      },
      // 支持任意圆角值
      borderRadius: {
        ...generateSpacing(100), // 1px 到 100px
      },
      // 支持任意宽高
      height: {
        ...generateSpacing(600),
        auto: 'auto',
        screen: '100vh',
      },
      width: {
        ...generateSpacing(600),
        auto: 'auto',
        screen: '100vw',
      },
      // 支持任意 z-index
      zIndex: {
        ...Array.from({ length: 10000 }, (_, i) => i + 1).reduce(
          (acc, i) => {
            acc[i] = `${i}`;
            return acc;
          },
          {} as Record<string, string>,
        ),
      },
    },
  },
  plugins: [],
} as Config;
