import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@src/ui';
import { useI18n } from '@src/lib/i18n';
import { useStrategies } from '../hooks/useStrategies';
interface StrategyItem {
  label: React.ReactNode;
  value: string;
}

interface TendBoxProps {
  onAnalyze: (strategy: StrategyItem) => void;
}

export const TendBox: React.FC<TendBoxProps> = ({ onAnalyze }) => {
  const { t } = useI18n();
  const strategies = useStrategies();
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const rightIcon = chrome.runtime.getURL('content-ui/platform/go.svg');
  const bookIcon = chrome.runtime.getURL('content-ui/politer/book.svg');

  const [selectType, setSelectType] = useState<string>('trendTracking');

  // 阻止滚动框的wheel事件冒泡
  useEffect(() => {
    const scrollBox = scrollBoxRef.current;
    if (!scrollBox) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    scrollBox.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      scrollBox.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 获取当前选中的策略类型列表
  const childs = useMemo<StrategyItem[]>(() => {
    return strategies[selectType as keyof typeof strategies] || [];
  }, [selectType, strategies]);

  // 策略类型选项
  const typeOptions = useMemo(() => {
    // 创建带图标的选项渲染函数
    const createOptionWithIcon = (label: string) => (
      <span className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px]">{label}</span>
        </div>
        {/* <img src={rightIcon} alt="book" className="w-[18px] h-[18px] flex-shrink-0" /> */}
      </span>
    );

    // 安全检查：如果 t 不存在，使用默认值
    if (!t) {
      return [
        { label: createOptionWithIcon('Trend-following'), displayLabel: 'Trend-following', value: 'trendTracking' },
        { label: createOptionWithIcon('Momentum Indicator'), displayLabel: 'Momentum Indicator', value: 'momentum' },
        {
          label: createOptionWithIcon('Overbought and Oversold'),
          displayLabel: 'Overbought and Oversold',
          value: 'overboughtOversold',
        },
        {
          label: createOptionWithIcon('Volume-Price Analysis'),
          displayLabel: 'Volume-Price Analysis',
          value: 'volumePrice',
        },
        { label: createOptionWithIcon('Pattern Recognition'), displayLabel: 'Pattern Recognition', value: 'pattern' },
        {
          label: createOptionWithIcon('Volatility Indicator'),
          displayLabel: 'Volatility Indicator',
          value: 'volatility',
        },
      ];
    }

    return [
      {
        label: createOptionWithIcon(t.strategy.types.trendTracking || 'Trend-following'),
        displayLabel: t.strategy.types.trendTracking || 'Trend-following',
        value: 'trendTracking',
      },
      {
        label: createOptionWithIcon(t.strategy.types.momentum || 'Momentum Indicator'),
        displayLabel: t.strategy.types.momentum || 'Momentum Indicator',
        value: 'momentum',
      },
      {
        label: createOptionWithIcon(t.strategy.types.overboughtOversold || 'Overbought and Oversold'),
        displayLabel: t.strategy.types.overboughtOversold || 'Overbought and Oversold',
        value: 'overboughtOversold',
      },
      {
        label: createOptionWithIcon(t.strategy.types.volumePrice || 'Volume-Price Analysis'),
        displayLabel: t.strategy.types.volumePrice || 'Volume-Price Analysis',
        value: 'volumePrice',
      },
      {
        label: createOptionWithIcon(t.strategy.types.pattern || 'Pattern Recognition'),
        displayLabel: t.strategy.types.pattern || 'Pattern Recognition',
        value: 'pattern',
      },
      {
        label: createOptionWithIcon(t.strategy.types.volatility || 'Volatility Indicator'),
        displayLabel: t.strategy.types.volatility || 'Volatility Indicator',
        value: 'volatility',
      },
    ];
  }, [t]);

  return (
    <div className="mt-4 w-full rounded-[8px]">
      {/* 策略类型选择器 */}
      <div className="flex items-center justify-center rounded-[8px] border-2 border-black bg-black">
        <div className="flex h-full w-full items-center justify-center text-center text-[18px] font-bold text-white">
          <Select
            value={selectType}
            onChange={value => setSelectType(value as string)}
            options={typeOptions}
            size="large"
            variant="borderless"
            className="w-full"
            inputClassName="text-[#CCFF00] text-left"
            dropdownClassName="bg-white text-black"
          />
        </div>
      </div>

      {/* 策略列表 */}
      <div
        ref={scrollBoxRef}
        className="custom-scrollbar mt-2 rounded-[8px]"
        id="scrollBox"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
        }}>
        {childs.map((item: StrategyItem, idx) => (
          <div
            key={item.value}
            className="child-item mb-[10px] mr-[4px] flex h-[56px] cursor-pointer items-center justify-between rounded-[4px] bg-[#F1F1F1] px-4 transition-colors hover:bg-gray-50"
            onClick={() => onAnalyze(item)}>
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <img src={bookIcon} alt="book" className="h-[18px] w-[18px] flex-shrink-0" />
              {item.label}
            </div>
            <img src={rightIcon} alt="right icon" className="h-[18px] w-[18px]" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TendBox;
