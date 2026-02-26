import React, { useMemo } from 'react';

interface RaceGaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color: 'green' | 'blue' | 'purple';
  metaphor: string;
  size?: number;
  average?: number;
  best?: number;
  bestLabel?: string;
}

const COLOR_MAP = {
  green: { hex: '#00ff88', rgb: '0, 255, 136', label: 'text-neon-green' },
  blue: { hex: '#00d4ff', rgb: '0, 212, 255', label: 'text-neon-blue' },
  purple: { hex: '#b44dff', rgb: '180, 77, 255', label: 'text-neon-purple' },
};

const RaceGauge: React.FC<RaceGaugeProps> = ({
  value,
  min,
  max,
  label,
  unit,
  color,
  metaphor,
  size = 160,
  average,
  best,
  bestLabel = 'best',
}) => {
  const c = COLOR_MAP[color];
  const cx = size / 2;
  const cy = size / 2 + 8;
  const radius = size / 2 - 18;
  const startAngle = -210;
  const endAngle = 30;
  const sweepDeg = endAngle - startAngle;

  const clampedValue = Math.min(Math.max(value, min), max);
  const fraction = max > min ? (clampedValue - min) / (max - min) : 0;

  const ticks = useMemo(() => {
    const tickCount = 10;
    const tickElements = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = i / tickCount;
      const angle = startAngle + t * sweepDeg;
      const rad = (angle * Math.PI) / 180;
      const innerR = radius - 8;
      const outerR = radius;
      const isMajor = i % 2 === 0;
      const tickInnerR = isMajor ? innerR - 5 : innerR;

      tickElements.push(
        <line
          key={i}
          x1={cx + tickInnerR * Math.cos(rad)}
          y1={cy + tickInnerR * Math.sin(rad)}
          x2={cx + outerR * Math.cos(rad)}
          y2={cy + outerR * Math.sin(rad)}
          stroke={c.hex}
          strokeWidth={isMajor ? 2.5 : 1.5}
          opacity={isMajor ? 0.9 : 0.4}
        />
      );

      if (isMajor) {
        const labelR = radius - 20;
        const val = min + t * (max - min);
        tickElements.push(
          <text
            key={`label-${i}`}
            x={cx + labelR * Math.cos(rad)}
            y={cy + labelR * Math.sin(rad)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={c.hex}
            fontSize="9"
            fontWeight="500"
            opacity="0.7"
          >
            {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
          </text>
        );
      }
    }
    return tickElements;
  }, [min, max, startAngle, sweepDeg, cx, cy, radius, c.hex]);

  const arcPath = useMemo(() => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = sweepDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }, [cx, cy, radius, startAngle, endAngle, sweepDeg]);

  const filledArcPath = useMemo(() => {
    const startRad = (startAngle * Math.PI) / 180;
    const fillAngle = startAngle + fraction * sweepDeg;
    const fillRad = (fillAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(fillRad);
    const y2 = cy + radius * Math.sin(fillRad);
    const actualSweep = fraction * sweepDeg;
    const largeArc = actualSweep > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }, [cx, cy, radius, startAngle, sweepDeg, fraction]);

  const displayValue = value > 0 ? (value >= 1000 ? `${(value / 1000).toFixed(2)}k` : value.toFixed(1)) : '--';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <defs>
          <filter id={`glow-${color}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c.hex} stopOpacity="0.3" />
            <stop offset="100%" stopColor={c.hex} stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {fraction > 0 && (
          <path
            d={filledArcPath}
            fill="none"
            stroke={`url(#grad-${color})`}
            strokeWidth="8"
            strokeLinecap="round"
            filter={`url(#glow-${color})`}
          />
        )}

        {ticks}

        {/* Digital value */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fill={c.hex}
          fontSize="18"
          fontWeight="bold"
          fontFamily="monospace"
          className="gauge-text-shadow"
        >
          {displayValue}
        </text>
        <text
          x={cx}
          y={cy + 34}
          textAnchor="middle"
          fill={c.hex}
          fontSize="10"
          opacity="0.7"
        >
          {unit}
        </text>
      </svg>

      {/* Label */}
      <div className="text-center -mt-1">
        <div className={`text-xs font-bold uppercase tracking-wider ${c.label}`}>
          {label}
        </div>
        <div className="text-[10px] text-gray-500 italic leading-tight">{metaphor}</div>
        <div className="text-[10px] text-gray-600 leading-tight" style={{ visibility: average !== undefined && average > 0 ? 'visible' : 'hidden' }}>
          avg: {average !== undefined && average > 0 ? (average >= 1000 ? `${(average / 1000).toFixed(2)}k` : average.toFixed(1)) : '—'} {unit}
        </div>
        <div className="text-[10px] text-yellow-500 leading-tight font-semibold" style={{ visibility: best !== undefined && best > 0 ? 'visible' : 'hidden' }}>
          {bestLabel}: {best !== undefined && best > 0 ? (best >= 1000 ? `${(best / 1000).toFixed(2)}k` : best.toFixed(1)) : '—'} {unit}
        </div>
      </div>
    </div>
  );
};

export default RaceGauge;
