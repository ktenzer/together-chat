import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LapResult } from '../types';

interface ModelResult {
  paneId: string;
  modelName: string;
  color: string;
  avgTTFT: number;
  avgTPS: number;
  avgE2E: number;
  minTTFT: number;
  maxTTFT: number;
  minTPS: number;
  maxTPS: number;
  minE2E: number;
  maxE2E: number;
  totalLaps: number;
}

interface RacePodiumProps {
  lapResults: LapResult[];
  modelColors: Record<string, string>;
  onRaceAgain: () => void;
}

function calcStats(values: number[]) {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, stdDev: 0 };
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return { avg, min, max, stdDev: Math.sqrt(variance) };
}

const confettiColors = ['#ffd700', '#ff3e3e', '#00ff88', '#00d4ff', '#b44dff', '#ff8800', '#ff69b4'];

const ConfettiPiece: React.FC<{ index: number }> = ({ index }) => {
  const style = useMemo(() => ({
    left: `${Math.random() * 100}%`,
    backgroundColor: confettiColors[index % confettiColors.length],
    '--fall-duration': `${2 + Math.random() * 2}s`,
    '--fall-delay': `${Math.random() * 1.5}s`,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    width: `${6 + Math.random() * 6}px`,
    height: `${6 + Math.random() * 6}px`,
  } as React.CSSProperties), [index]);

  return <div className="confetti-piece" style={style} />;
};

const RacePodium: React.FC<RacePodiumProps> = ({ lapResults, modelColors, onRaceAgain }) => {
  const results = useMemo((): ModelResult[] => {
    const modelMap: Record<string, { ttft: number[]; tps: number[]; e2e: number[]; modelName: string; color: string }> = {};

    lapResults.forEach(lap => {
      lap.paneMetrics.forEach(pm => {
        if (!modelMap[pm.paneId]) {
          modelMap[pm.paneId] = {
            ttft: [],
            tps: [],
            e2e: [],
            modelName: pm.modelName,
            color: modelColors[pm.paneId] || '#888',
          };
        }
        if (pm.metrics.timeToFirstToken) modelMap[pm.paneId].ttft.push(pm.metrics.timeToFirstToken);
        if (pm.metrics.tokensPerSecond) modelMap[pm.paneId].tps.push(pm.metrics.tokensPerSecond);
        if (pm.metrics.endToEndLatency) modelMap[pm.paneId].e2e.push(pm.metrics.endToEndLatency);
      });
    });

    return Object.entries(modelMap).map(([paneId, data]) => {
      const ttftStats = calcStats(data.ttft);
      const tpsStats = calcStats(data.tps);
      const e2eStats = calcStats(data.e2e);
      return {
        paneId,
        modelName: data.modelName,
        color: data.color,
        avgTTFT: ttftStats.avg,
        avgTPS: tpsStats.avg,
        avgE2E: e2eStats.avg,
        minTTFT: ttftStats.min,
        maxTTFT: ttftStats.max,
        minTPS: tpsStats.min,
        maxTPS: tpsStats.max,
        minE2E: e2eStats.min,
        maxE2E: e2eStats.max,
        totalLaps: data.tps.length,
      };
    }).sort((a, b) => b.avgTPS - a.avgTPS);
  }, [lapResults, modelColors]);

  const chartData = useMemo(() => {
    return lapResults.map((lap, i) => {
      const point: Record<string, number | string | undefined> = { lap: i + 1 };
      lap.paneMetrics.forEach(pm => {
        if (pm.metrics.timeToFirstToken) point[`${pm.paneId}_ttft`] = pm.metrics.timeToFirstToken;
        if (pm.metrics.tokensPerSecond) point[`${pm.paneId}_tps`] = pm.metrics.tokensPerSecond;
        if (pm.metrics.endToEndLatency) point[`${pm.paneId}_e2e`] = pm.metrics.endToEndLatency;
      });
      return point;
    });
  }, [lapResults]);

  const modelKeys = useMemo(() => {
    return results.map(r => {
      const displayName = r.modelName.length > 30 ? r.modelName.substring(0, 28) + '..' : r.modelName;
      return { paneId: r.paneId, displayName, color: r.color };
    });
  }, [results]);

  const podiumOrder = useMemo(() => {
    if (results.length === 0) return [];
    if (results.length === 1) return [{ ...results[0], position: 1 }];
    if (results.length === 2) return [
      { ...results[1], position: 2 },
      { ...results[0], position: 1 },
    ];
    return [
      { ...results[1], position: 2 },
      { ...results[0], position: 1 },
      { ...results[2], position: 3 },
    ];
  }, [results]);

  const podiumHeights: Record<number, number> = { 1: 160, 2: 120, 3: 90 };
  const trophyColors: Record<number, string> = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
  const placeLabels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

  const formatVal = (v: number, unit: string) => {
    if (unit === 'tok/s') return v.toFixed(1);
    return v >= 1000 ? `${(v / 1000).toFixed(2)}k` : v.toFixed(0);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto race-dark-scrollbar bg-gradient-to-b from-race-dark to-asphalt">
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </div>

      {/* Podium section */}
      <div className="relative pt-8 pb-6 px-4">
        <motion.h1
          className="text-3xl font-black text-center mb-8 tracking-wider"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
        >
          RACE RESULTS
        </motion.h1>

        <div className="flex items-end justify-center gap-4 max-w-2xl mx-auto">
          {podiumOrder.map((entry) => {
            const h = podiumHeights[entry.position];
            const delays = { 2: 0.3, 1: 0.6, 3: 0.9 };
            const delay = delays[entry.position as 1 | 2 | 3] || 0.3;

            return (
              <motion.div
                key={entry.paneId}
                className="flex flex-col items-center"
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay, duration: 0.7, type: 'spring', bounce: 0.3 }}
                style={{ width: entry.position === 1 ? '200px' : '160px' }}
              >
                {/* Trophy */}
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: delay + 0.3, duration: 0.5, type: 'spring' }}
                >
                  <Trophy
                    size={entry.position === 1 ? 48 : 36}
                    color={trophyColors[entry.position]}
                    fill={trophyColors[entry.position]}
                    style={{ filter: `drop-shadow(0 0 10px ${trophyColors[entry.position]})` }}
                  />
                </motion.div>

                <div className="text-sm font-bold text-gray-300 mt-2 text-center w-full px-2 leading-tight break-words">
                  {entry.modelName.length > 30 ? entry.modelName.substring(0, 28) + '..' : entry.modelName}
                </div>
                <div className="text-xs text-gray-500 mb-2">{entry.totalLaps} laps</div>

                {/* Podium block */}
                <div
                  className="w-full rounded-t-lg flex flex-col items-center justify-center relative"
                  style={{
                    height: `${h}px`,
                    background: `linear-gradient(180deg, ${entry.color}33 0%, ${entry.color}11 100%)`,
                    border: `1px solid ${entry.color}44`,
                    borderBottom: 'none',
                  }}
                >
                  <span className="text-2xl font-black" style={{ color: trophyColors[entry.position] }}>
                    {placeLabels[entry.position]}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats row - aligned across all models */}
        <div className="flex justify-center gap-4 max-w-2xl mx-auto mb-6">
          {podiumOrder.map((entry) => (
            <div
              key={entry.paneId}
              className="text-center py-2 rounded-b-lg"
              style={{
                width: entry.position === 1 ? '200px' : '160px',
                background: `linear-gradient(180deg, ${entry.color}11 0%, ${entry.color}08 100%)`,
                borderLeft: `1px solid ${entry.color}44`,
                borderRight: `1px solid ${entry.color}44`,
                borderBottom: `1px solid ${entry.color}44`,
              }}
            >
              <div className="text-xs text-gray-400 space-y-0.5">
                <div><span className="text-neon-green">TTFT:</span> {formatVal(entry.avgTTFT, 'ms')}ms</div>
                <div><span className="text-neon-purple">TPS:</span> {formatVal(entry.avgTPS, 'tok/s')}</div>
                <div><span className="text-neon-blue">E2E:</span> {formatVal(entry.avgE2E, 'ms')}ms</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts section */}
      <div className="px-6 pb-8 space-y-6">
        <h2 className="text-lg font-bold text-gray-300 text-center">Performance Across All Laps</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* TTFT Chart */}
          <div className="bg-race-surface rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-neon-green mb-3 text-center">TTFT (Cornering) - ms</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="lap" stroke="#555" fontSize={10} label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: '#555', fontSize: 10 }} />
                <YAxis stroke="#555" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {modelKeys.map(mk => (
                  <Line
                    key={`${mk.paneId}_ttft`}
                    type="monotone"
                    dataKey={`${mk.paneId}_ttft`}
                    name={mk.displayName}
                    stroke={mk.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: mk.color }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* TPS Chart */}
          <div className="bg-race-surface rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-neon-purple mb-3 text-center">TPS (Top Speed) - tok/s</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="lap" stroke="#555" fontSize={10} label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: '#555', fontSize: 10 }} />
                <YAxis stroke="#555" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {modelKeys.map(mk => (
                  <Line
                    key={`${mk.paneId}_tps`}
                    type="monotone"
                    dataKey={`${mk.paneId}_tps`}
                    name={mk.displayName}
                    stroke={mk.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: mk.color }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* E2E Chart */}
          <div className="bg-race-surface rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-bold text-neon-blue mb-3 text-center">E2E (Lap Time) - ms</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="lap" stroke="#555" fontSize={10} label={{ value: 'Lap', position: 'insideBottom', offset: -2, fill: '#555', fontSize: 10 }} />
                <YAxis stroke="#555" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                {modelKeys.map(mk => (
                  <Line
                    key={`${mk.paneId}_e2e`}
                    type="monotone"
                    dataKey={`${mk.paneId}_e2e`}
                    name={mk.displayName}
                    stroke={mk.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: mk.color }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary stats table */}
        <div className="bg-race-surface rounded-xl p-4 border border-gray-800 overflow-x-auto">
          <h3 className="text-sm font-bold text-gray-300 mb-3 text-center">Detailed Statistics</h3>
          <table className="w-full text-xs text-gray-400">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3">Model</th>
                <th className="text-center py-2 px-2">Laps</th>
                <th className="text-center py-2 px-2 text-neon-green">Avg TTFT</th>
                <th className="text-center py-2 px-2 text-neon-green">Min/Max TTFT</th>
                <th className="text-center py-2 px-2 text-neon-purple">Avg TPS</th>
                <th className="text-center py-2 px-2 text-neon-purple">Min/Max TPS</th>
                <th className="text-center py-2 px-2 text-neon-blue">Avg E2E</th>
                <th className="text-center py-2 px-2 text-neon-blue">Min/Max E2E</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.paneId} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 font-medium text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="truncate max-w-[250px]">{r.modelName.length > 30 ? r.modelName.substring(0, 28) + '..' : r.modelName}</span>
                  </td>
                  <td className="text-center py-2 px-2">{r.totalLaps}</td>
                  <td className="text-center py-2 px-2">{formatVal(r.avgTTFT, 'ms')}ms</td>
                  <td className="text-center py-2 px-2">{formatVal(r.minTTFT, 'ms')} / {formatVal(r.maxTTFT, 'ms')}</td>
                  <td className="text-center py-2 px-2">{r.avgTPS.toFixed(1)}</td>
                  <td className="text-center py-2 px-2">{r.minTPS.toFixed(1)} / {r.maxTPS.toFixed(1)}</td>
                  <td className="text-center py-2 px-2">{formatVal(r.avgE2E, 'ms')}ms</td>
                  <td className="text-center py-2 px-2">{formatVal(r.minE2E, 'ms')} / {formatVal(r.maxE2E, 'ms')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Race Again button */}
        <div className="flex justify-center pt-2 pb-4">
          <motion.button
            onClick={onRaceAgain}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-neon-green/20 to-neon-blue/20 text-white font-bold rounded-xl border border-neon-green/40 hover:border-neon-green/70 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw size={18} />
            Race Again
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default RacePodium;
