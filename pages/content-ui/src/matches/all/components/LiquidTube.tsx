import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export interface LiquidTubeProps {
  level: 'Healthy' | 'Caution' | 'Critical' | null;
  className?: string;
}

const SHELL_CENTER_PATH =
  'M21.5 5C26.1944 5 30 8.80558 30 13.5V66.3171C30 66.5663 30.1226 66.7988 30.3231 66.9468C33.9915 69.6554 36.3711 74.0091 36.3711 78.9189C36.3711 87.133 29.7121 93.792 21.498 93.792C13.284 93.792 6.625 87.133 6.625 78.9189C6.62503 74.0074 9.00617 69.6522 12.6767 66.9439C12.8773 66.7959 13 66.5633 13 66.314V13.5C13 8.80558 16.8056 5 21.5 5Z';

const BULB_PATH =
  'M26.2158 70.2031C29.089 71.8895 31.0331 75.0707 31.0332 78.7285C31.0332 84.1663 26.7463 88.5399 21.5 88.54C16.2536 88.54 11.9658 84.1664 11.9658 78.7285C11.9659 75.0706 13.9109 71.8895 16.7842 70.2031C17.7684 69.6254 18.5556 68.5793 18.5557 67.3096H24.4434C24.4434 68.5794 25.2315 69.6254 26.2158 70.2031Z';

const ARROW_PATH = 'M29.4893 23.4346H24.4434H18.5557H13.5098L21.499 13.96L29.4893 23.4346Z';

const ARROW_BASE_Y = 23.4346;
const ARROW_TOP_CLEARANCE_Y = 4;
const TUBE_LEFT = 18.5557;
const TUBE_RIGHT = 24.4434;
const TUBE_BOTTOM = 67.3096;
const MIN_ARROW_Y = ARROW_TOP_CLEARANCE_Y;
const MAX_ARROW_Y = 43.8;
const SEAM_OVERLAP = 0.8;
const LIQUID_SCALE = 1.18;
const LIQUID_TRANSFORM = `translate(21.5 78.7285) scale(${LIQUID_SCALE}) translate(-21.5 -78.7285)`;
const PULSE_KEY_TIMES = '0;0.18;0.34;0.72;1';

type LiquidLevel = NonNullable<LiquidTubeProps['level']>;

function getTubeHeight(arrowY: number) {
  return Math.max(0, TUBE_BOTTOM - ARROW_BASE_Y - arrowY + SEAM_OVERLAP * 2);
}

function getTubeY(arrowY: number) {
  return ARROW_BASE_Y - SEAM_OVERLAP + arrowY;
}

function getPulseDuration(level: LiquidLevel | null) {
  if (level === 'Healthy') {
    return '2.4s';
  }

  if (level === 'Caution') {
    return '3.2s';
  }

  if (level === 'Critical') {
    return '4.2s';
  }

  return '3.2s';
}

function getLiquidState(level: LiquidLevel | null) {
  if (level === null) {
    return {
      color: 'transparent',
      glowColor: 'transparent',
      arrowY: MAX_ARROW_Y,
      tubeHeight: 0,
    };
  }

  if (level === 'Healthy') {
    const arrowY = MIN_ARROW_Y;
    return {
      color: '#A5FFBF',
      glowColor: 'rgba(165, 255, 191, 0.9)',
      arrowY,
      tubeHeight: getTubeHeight(arrowY),
    };
  }

  if (level === 'Caution') {
    const arrowY = (MIN_ARROW_Y + MAX_ARROW_Y) / 2;
    return {
      color: '#E5FF7F',
      glowColor: 'rgba(229, 255, 127, 0.9)',
      arrowY,
      tubeHeight: getTubeHeight(arrowY),
    };
  }

  const arrowY = MAX_ARROW_Y;
  return {
    color: '#FF888D',
    glowColor: 'rgba(255, 136, 141, 0.9)',
    arrowY,
    tubeHeight: getTubeHeight(arrowY),
  };
}

export const LiquidTube = ({ level, className }: LiquidTubeProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const liquidState = useMemo(() => getLiquidState(level), [level]);
  const pulseDuration = useMemo(() => getPulseDuration(level), [level]);
  const shortArrowY = MAX_ARROW_Y * 0.82;
  const arrowValues = [shortArrowY, MIN_ARROW_Y, MAX_ARROW_Y, MIN_ARROW_Y, shortArrowY];
  const tubeYValues = arrowValues.map(arrowY => getTubeY(arrowY)).join(';');
  const tubeHeightValues = arrowValues.map(arrowY => getTubeHeight(arrowY)).join(';');
  const arrowTranslateValues = arrowValues.map(arrowY => `0 ${arrowY}`).join(';');

  return (
    <div
      className={`relative transition-all duration-500 ease-out will-change-transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${className ?? ''}`}>
      <svg
        width={54}
        height={90}
        viewBox="0 0 43 94"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block h-full w-full"
        role="img"
        aria-label="Market liquidity thermometer">
        <rect width="43" height="94" fill="var(--tube-bg)" />
        <path d={SHELL_CENTER_PATH} fill="none" stroke="#000000" strokeWidth="2.57628" strokeLinejoin="round" />
        <g transform={LIQUID_TRANSFORM}>
          <g
            style={
              {
                animation: `liquidTubePulse ${pulseDuration} ease-in-out infinite`,
                '--liquid-glow': liquidState.glowColor,
              } as CSSProperties
            }>
            <path d={BULB_PATH} fill={liquidState.color} style={{ transition: 'fill 420ms ease' }} />
            <rect
              x={TUBE_LEFT}
              y={getTubeY(liquidState.arrowY)}
              width={TUBE_RIGHT - TUBE_LEFT}
              height={liquidState.tubeHeight}
              fill={liquidState.color}
              style={{ transition: 'fill 420ms ease' }}>
              <animate
                attributeName="y"
                dur={pulseDuration}
                keyTimes={PULSE_KEY_TIMES}
                repeatCount="indefinite"
                values={tubeYValues}
              />
              <animate
                attributeName="height"
                dur={pulseDuration}
                keyTimes={PULSE_KEY_TIMES}
                repeatCount="indefinite"
                values={tubeHeightValues}
              />
            </rect>
            <g transform={`translate(0 ${liquidState.arrowY})`}>
              <path
                d={ARROW_PATH}
                fill={liquidState.color}
                style={{ transition: 'fill 420ms ease, opacity 240ms ease', opacity: 1 }}
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                dur={pulseDuration}
                keyTimes={PULSE_KEY_TIMES}
                repeatCount="indefinite"
                values={arrowTranslateValues}
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};
