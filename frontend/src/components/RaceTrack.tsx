import React, { useMemo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { PerformanceMetrics } from '../types';

interface CarData {
  id: string;
  modelName: string;
  color: string;
  progress: number;
  lap: number;
  currentMetrics?: PerformanceMetrics;
  isStreaming: boolean;
}

interface RaceTrackProps {
  cars: CarData[];
  currentLap: number;
  totalLaps: number | null;
  raceStatus: 'waiting' | 'racing' | 'finished';
  elapsedTime: number;
}

const TRACK_WIDTH = 900;
const TRACK_HEIGHT = 400;
const PADDING = 50;
const CORNER_RADIUS = 120;

function getPointOnTrack(t: number): { x: number; y: number; angle: number } {
  const clamped = ((t % 1) + 1) % 1;

  const innerLeft = PADDING + CORNER_RADIUS;
  const innerRight = TRACK_WIDTH - PADDING - CORNER_RADIUS;
  const straightLen = innerRight - innerLeft;
  const curveLen = Math.PI * CORNER_RADIUS;
  const totalLen = 2 * straightLen + 2 * curveLen;

  let dist = clamped * totalLen;

  // Top straight (right to left)
  if (dist < straightLen) {
    const frac = dist / straightLen;
    return {
      x: innerRight - frac * straightLen,
      y: PADDING + 40,
      angle: 180,
    };
  }
  dist -= straightLen;

  // Left curve (top to bottom)
  if (dist < curveLen) {
    const frac = dist / curveLen;
    const angle = Math.PI / 2 + frac * Math.PI;
    return {
      x: innerLeft + CORNER_RADIUS * Math.cos(angle),
      y: PADDING + 40 + CORNER_RADIUS + CORNER_RADIUS * Math.sin(angle),
      angle: (frac * 180 + 180) % 360,
    };
  }
  dist -= curveLen;

  // Bottom straight (left to right)
  if (dist < straightLen) {
    const frac = dist / straightLen;
    return {
      x: innerLeft + frac * straightLen,
      y: TRACK_HEIGHT - PADDING + 10,
      angle: 0,
    };
  }
  dist -= straightLen;

  // Right curve (bottom to top)
  const frac = dist / curveLen;
  const angle = -Math.PI / 2 + frac * Math.PI;
  return {
    x: innerRight + CORNER_RADIUS * Math.cos(angle),
    y: PADDING + 40 + CORNER_RADIUS + CORNER_RADIUS * Math.sin(angle),
    angle: (frac * 180) % 360,
  };
}

const AnimatedCar: React.FC<{ car: CarData; index: number }> = ({ car, index }) => {
  const springProgress = useSpring(car.progress, {
    stiffness: 40,
    damping: 20,
  });

  React.useEffect(() => {
    springProgress.set(car.progress);
  }, [car.progress, springProgress]);

  const x = useTransform(springProgress, (p) => getPointOnTrack(p).x);
  const y = useTransform(springProgress, (p) => getPointOnTrack(p).y);

  const laneOffsets = [-14, 0, 14];
  const laneOffset = laneOffsets[index] || 0;

  const formatMetric = (val?: number) => (val ? val.toFixed(0) : '--');
  const formatTPS = (val?: number) => (val ? val.toFixed(1) : '--');

  const shortName = car.modelName.length > 16 ? car.modelName.substring(0, 14) + '..' : car.modelName;

  return (
    <motion.g style={{ x, y }}>
      <g transform={`translate(0, ${laneOffset})`}>
        {/* Car glow */}
        <motion.circle
          r="12"
          fill={car.color}
          opacity={0.15}
          animate={car.isStreaming ? { r: [12, 18, 12], opacity: [0.15, 0.3, 0.15] } : {}}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Car body */}
        <rect x="-10" y="-6" width="20" height="12" rx="4" fill={car.color} />
        <rect x="-7" y="-4" width="8" height="8" rx="2" fill="rgba(255,255,255,0.2)" />
        <rect x="4" y="-3" width="4" height="6" rx="1" fill="rgba(255,255,255,0.15)" />

        {/* HUD above car */}
        <g transform="translate(0, -22)">
          <rect x="-52" y="-22" width="104" height="20" rx="4" fill="rgba(0,0,0,0.85)" stroke={car.color} strokeWidth="0.5" />
          <text x="-48" y="-9" fontSize="7" fill={car.color} fontWeight="bold" fontFamily="monospace">
            {shortName}
          </text>
          <text x="-48" y="-1" fontSize="6" fill="#888" fontFamily="monospace">
            <tspan fill="#00ff88">T:{formatMetric(car.currentMetrics?.timeToFirstToken)}</tspan>
            <tspan dx="4" fill="#b44dff">S:{formatTPS(car.currentMetrics?.tokensPerSecond)}</tspan>
            <tspan dx="4" fill="#00d4ff">E:{formatMetric(car.currentMetrics?.endToEndLatency)}</tspan>
          </text>
        </g>
      </g>
    </motion.g>
  );
};

const RaceTrack: React.FC<RaceTrackProps> = ({ cars, currentLap, totalLaps, raceStatus, elapsedTime }) => {
  const trackPath = useMemo(() => {
    const il = PADDING + CORNER_RADIUS;
    const ir = TRACK_WIDTH - PADDING - CORNER_RADIUS;
    const top = PADDING + 40;
    const bot = TRACK_HEIGHT - PADDING + 10;

    return `
      M ${ir} ${top}
      L ${il} ${top}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${il} ${bot}
      L ${ir} ${bot}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${ir} ${top}
      Z
    `;
  }, []);

  const outerPath = useMemo(() => {
    const or = CORNER_RADIUS + 20;
    const il = PADDING + CORNER_RADIUS;
    const ir = TRACK_WIDTH - PADDING - CORNER_RADIUS;
    const top = PADDING + 40 - 20;
    const bot = TRACK_HEIGHT - PADDING + 10 + 20;

    return `
      M ${ir} ${top}
      L ${il} ${top}
      A ${or} ${or} 0 0 0 ${il} ${bot}
      L ${ir} ${bot}
      A ${or} ${or} 0 0 0 ${ir} ${top}
      Z
    `;
  }, []);

  const innerPath = useMemo(() => {
    const innr = CORNER_RADIUS - 20;
    const il = PADDING + CORNER_RADIUS;
    const ir = TRACK_WIDTH - PADDING - CORNER_RADIUS;
    const top = PADDING + 40 + 20;
    const bot = TRACK_HEIGHT - PADDING + 10 - 20;

    return `
      M ${ir} ${top}
      L ${il} ${top}
      A ${innr} ${innr} 0 0 0 ${il} ${bot}
      L ${ir} ${bot}
      A ${innr} ${innr} 0 0 0 ${ir} ${top}
      Z
    `;
  }, []);

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Finish line position (right side of top straight)
  const finishX = TRACK_WIDTH - PADDING - CORNER_RADIUS - 10;
  const finishTop = PADDING + 40 - 22;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-b from-race-dark to-asphalt">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <svg viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="track-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer kerbing */}
        <path d={outerPath} fill="none" stroke="#e74c3c" strokeWidth="4" strokeDasharray="10 10" opacity="0.4" />

        {/* Track surface */}
        <path d={trackPath} fill="rgba(60,60,70,0.6)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

        {/* Lane markings (dashed center line) */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="15 15" />

        {/* Inner kerbing */}
        <path d={innerPath} fill="none" stroke="#e74c3c" strokeWidth="4" strokeDasharray="10 10" opacity="0.3" />

        {/* Inner grass/area */}
        <path d={innerPath} fill="rgba(34, 197, 94, 0.05)" />

        {/* Finish line checkered */}
        <g>
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 2 }).map((_, col) => (
              <rect
                key={`check-${row}-${col}`}
                x={finishX + col * 6}
                y={finishTop + row * 11}
                width="6"
                height="11"
                fill={(row + col) % 2 === 0 ? 'white' : 'black'}
                opacity="0.7"
              />
            ))
          )}
        </g>

        {/* Center area - Lap counter */}
        <g>
          <rect
            x={TRACK_WIDTH / 2 - 80}
            y={TRACK_HEIGHT / 2 - 35}
            width="160"
            height="70"
            rx="12"
            fill="rgba(0,0,0,0.7)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {raceStatus === 'waiting' && (
            <text
              x={TRACK_WIDTH / 2}
              y={TRACK_HEIGHT / 2 + 5}
              textAnchor="middle"
              fill="#888"
              fontSize="16"
              fontFamily="monospace"
            >
              READY TO RACE
            </text>
          )}

          {raceStatus === 'racing' && (
            <>
              <text
                x={TRACK_WIDTH / 2}
                y={TRACK_HEIGHT / 2 - 12}
                textAnchor="middle"
                fill="#00ff88"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="bold"
                opacity="0.7"
              >
                LAP
              </text>
              <text
                x={TRACK_WIDTH / 2}
                y={TRACK_HEIGHT / 2 + 12}
                textAnchor="middle"
                fill="white"
                fontSize="24"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {currentLap}{totalLaps ? ` / ${totalLaps}` : ''}
              </text>
              <text
                x={TRACK_WIDTH / 2}
                y={TRACK_HEIGHT / 2 + 28}
                textAnchor="middle"
                fill="#666"
                fontSize="10"
                fontFamily="monospace"
              >
                {formatElapsed(elapsedTime)}
              </text>
            </>
          )}

          {raceStatus === 'finished' && (
            <>
              <text
                x={TRACK_WIDTH / 2}
                y={TRACK_HEIGHT / 2 - 5}
                textAnchor="middle"
                fill="#ffd700"
                fontSize="18"
                fontFamily="monospace"
                fontWeight="bold"
              >
                FINISHED
              </text>
              <text
                x={TRACK_WIDTH / 2}
                y={TRACK_HEIGHT / 2 + 18}
                textAnchor="middle"
                fill="#888"
                fontSize="12"
                fontFamily="monospace"
              >
                {currentLap} laps - {formatElapsed(elapsedTime)}
              </text>
            </>
          )}
        </g>

        {/* Cars */}
        {cars.map((car, i) => (
          <AnimatedCar key={car.id} car={car} index={i} />
        ))}
      </svg>
    </div>
  );
};

export default RaceTrack;
