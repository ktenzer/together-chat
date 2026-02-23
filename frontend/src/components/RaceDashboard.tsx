import React from 'react';
import RaceGauge from './RaceGauge';
import { PerformanceMetrics } from '../types';

interface RaceDashboardProps {
  modelName: string;
  carColor: string;
  currentMetrics?: PerformanceMetrics;
  averageMetrics?: {
    avgTTFT: number;
    avgE2E: number;
    avgTPS: number;
  };
  bestMetrics?: {
    bestTTFT: number;
    bestTPS: number;
    bestE2E: number;
  };
  rank?: number;
  lapCount: number;
}

const CAR_COLORS: Record<string, string> = {
  '#ef4444': 'bg-red-500',
  '#3b82f6': 'bg-blue-500',
  '#22c55e': 'bg-green-500',
};

const RANK_BADGES: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: '1st', bg: 'bg-yellow-400', text: 'text-yellow-900' },
  2: { label: '2nd', bg: 'bg-gray-300', text: 'text-gray-700' },
  3: { label: '3rd', bg: 'bg-orange-400', text: 'text-orange-900' },
};

const RaceDashboard: React.FC<RaceDashboardProps> = ({
  modelName,
  carColor,
  currentMetrics,
  averageMetrics,
  bestMetrics,
  rank,
  lapCount,
}) => {
  const ttft = currentMetrics?.timeToFirstToken || 0;
  const tps = currentMetrics?.tokensPerSecond || 0;
  const e2e = currentMetrics?.endToEndLatency || 0;

  const colorClass = CAR_COLORS[carColor] || 'bg-gray-500';
  const badge = rank ? RANK_BADGES[rank] : null;

  const truncatedName = modelName.length > 25 ? modelName.substring(0, 23) + '..' : modelName;

  return (
    <div className="relative rounded-xl overflow-hidden carbon-fiber bg-race-dark border border-gray-800">
      {/* Team banner header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-800/60 bg-gradient-to-r from-gray-900/80 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-3 h-3 rounded-full ${colorClass} flex-shrink-0`} style={{ boxShadow: `0 0 8px ${carColor}` }} />
          <span className="text-sm font-bold text-gray-200 truncate">{truncatedName}</span>
          <span className="text-xs text-gray-500 flex-shrink-0">({lapCount} laps)</span>
        </div>
        {badge && (
          <div className={`${badge.bg} ${badge.text} rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs shadow-md flex-shrink-0`}>
            {rank}
          </div>
        )}
      </div>

      {/* Gauges */}
      <div className="flex items-center justify-around px-1 py-1">
        <RaceGauge
          value={ttft}
          min={0}
          max={2000}
          label="TTFT"
          unit="ms"
          color="green"
          metaphor="Cornering"
          size={140}
          average={averageMetrics?.avgTTFT}
          best={bestMetrics?.bestTTFT}
          bestLabel="low"
        />
        <RaceGauge
          value={tps}
          min={0}
          max={500}
          label="TPS"
          unit="tok/s"
          color="purple"
          metaphor="Top Speed"
          size={140}
          average={averageMetrics?.avgTPS}
          best={bestMetrics?.bestTPS}
          bestLabel="high"
        />
        <RaceGauge
          value={e2e}
          min={0}
          max={15000}
          label="E2E"
          unit="ms"
          color="blue"
          metaphor="Lap Time"
          size={140}
          average={averageMetrics?.avgE2E}
          best={bestMetrics?.bestE2E}
          bestLabel="low"
        />
      </div>
    </div>
  );
};

export default RaceDashboard;
