import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Flag, Square, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import RaceTrack from './RaceTrack';
import RaceDashboard from './RaceDashboard';
import RacePodium from './RacePodium';
import { ChatInterfaceProps, RaceState, LapResult, PerformanceMetrics } from '../types';
import { getRandomDemoImage, getDemoImageUrl } from '../data/demoImages';

const CAR_COLORS = ['#ef4444', '#3b82f6', '#22c55e'];

const ESTIMATED_TOKENS_PER_LAP = 350;

type QuestionType = 'essay' | 'summary' | 'image' | 'coding' | 'toolCalling';

interface PregenQuestion {
  text: string;
  imagePath?: string;
  questionType: QuestionType;
}

interface PerPaneLapEntry {
  lapNumber: number;
  questionType: string;
  modelName: string;
  metrics: PerformanceMetrics;
}

const PerformanceView: React.FC<ChatInterfaceProps> = ({
  panes,
  onSendMessageToPane,
  onClearChat,
  demoWordCount,
  demoIncludeEssays,
  demoIncludeSummaries,
  demoIncludeImages,
  demoIncludeCoding,
  demoIncludeToolCalling,
  onDemoStateChange,
  sidebarCollapsed = false,
  limitedRuns = false,
  numberOfRuns = 10,
}) => {
  const [raceState, setRaceState] = useState<RaceState>({
    status: 'waiting',
    currentLap: 0,
    totalLaps: limitedRuns ? numberOfRuns : null,
    lapResults: [],
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [tick, setTick] = useState(0);

  const raceStartTimeRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const isRacingRef = useRef(false);
  const raceFinishedRef = useRef(false);

  // Refs for async loop access (loops can't see latest React state)
  const panesRef = useRef(panes);
  useEffect(() => { panesRef.current = panes; }, [panes]);

  const sendToPaneRef = useRef(onSendMessageToPane);
  useEffect(() => { sendToPaneRef.current = onSendMessageToPane; }, [onSendMessageToPane]);

  const totalLapsRef = useRef(limitedRuns ? numberOfRuns : null);
  useEffect(() => { totalLapsRef.current = limitedRuns ? numberOfRuns : null; }, [limitedRuns, numberOfRuns]);

  // Pre-generated question list (same for all models = fair)
  const questionListRef = useRef<PregenQuestion[]>([]);
  // Per-model lap counter
  const perModelLapRef = useRef<Record<string, number>>({});
  // Per-model completed lap results
  const perPaneLapResultsRef = useRef<Record<string, PerPaneLapEntry[]>>({});
  // Track which models have finished all laps
  const modelFinishedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setRaceState(prev => ({
      ...prev,
      totalLaps: limitedRuns ? numberOfRuns : null,
    }));
  }, [limitedRuns, numberOfRuns]);

  const modelColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    panes.forEach((pane, i) => {
      map[pane.id] = CAR_COLORS[i] || '#888';
    });
    return map;
  }, [panes]);

  const getDemoQuestions = useCallback((wordCount: number) => {
    const essayQuestions = [
      `Write a ${wordCount} word essay on the evolution of artificial intelligence and its impact on modern society.`,
      `Write a ${wordCount} word essay on climate change and its effects on global ecosystems.`,
      `Write a ${wordCount} word essay on the role of machine learning in healthcare innovation.`,
      `Write a ${wordCount} word essay on the future of renewable energy technologies.`,
      `Write a ${wordCount} word essay on the impact of social media on human communication.`,
      `Write a ${wordCount} word essay on quantum computing and its potential applications.`,
      `Write a ${wordCount} word essay on the future of space exploration and colonization.`,
      `Write a ${wordCount} word essay on cybersecurity challenges in the digital age.`,
      `Write a ${wordCount} word essay on the impact of automation on the job market.`,
      `Write a ${wordCount} word essay on the ethics of genetic engineering and CRISPR technology.`,
    ];

    const summaryQuestions = [
      `Summarize the following article about digital transformation in business in ${wordCount} words:\n\nDigital transformation has become a critical imperative for businesses across all industries. Companies are increasingly adopting cloud computing, artificial intelligence, and data analytics to streamline operations and enhance customer experiences. The COVID-19 pandemic accelerated this trend, forcing organizations to rapidly digitize their processes to maintain business continuity. Key drivers of digital transformation include the need for operational efficiency, improved customer engagement, and competitive advantage. Organizations are investing heavily in technologies such as machine learning algorithms for predictive analytics, robotic process automation for routine tasks, and Internet of Things devices for real-time monitoring. However, digital transformation presents significant challenges. Legacy systems often create integration difficulties, requiring substantial investment in infrastructure upgrades. Employee resistance to change remains a major obstacle, necessitating comprehensive training programs and change management strategies. The benefits of successful digital transformation are substantial. Organizations report improved operational efficiency, reduced costs, enhanced customer satisfaction, and increased revenue streams.`,
      `Summarize the following article about sustainable business practices in ${wordCount} words:\n\nSustainability has evolved from a corporate social responsibility initiative to a core business strategy. Companies worldwide are recognizing that sustainable practices not only benefit the environment but also drive long-term profitability and stakeholder value. Environmental sustainability encompasses reducing carbon footprints, minimizing waste, and conserving natural resources. Companies are implementing circular economy principles, designing products for longevity and recyclability. Social sustainability focuses on fair labor practices, community engagement, and diversity and inclusion initiatives. Economic sustainability involves creating business models that generate long-term value while considering environmental and social impacts. The business case for sustainability is compelling. Sustainable practices often lead to cost savings through improved efficiency and waste reduction. Technology plays a crucial role in enabling sustainable practices. IoT sensors monitor resource consumption, AI optimizes energy usage, and blockchain ensures supply chain transparency.`,
      `Summarize the following article about remote work trends in ${wordCount} words:\n\nThe remote work revolution has fundamentally transformed the modern workplace. What began as an emergency response to the COVID-19 pandemic has evolved into a permanent shift in how and where people work. Remote work adoption has reached unprecedented levels. Studies indicate that over 40 percent of the workforce now works remotely at least part-time. Benefits of remote work are well-documented. Employees report improved work-life balance, reduced commuting stress, and increased productivity. Companies benefit from access to global talent pools, reduced real estate costs, and higher employee satisfaction. However, remote work presents significant challenges. Maintaining company culture and team cohesion becomes more difficult. Technology infrastructure is critical for remote work success. The future workplace will likely be hybrid, combining remote and in-office work.`,
    ];

    const codingQuestions = [
      'Create a Python function that implements a binary search algorithm with proper error handling and documentation.',
      'Write a JavaScript function that debounces API calls and includes unit tests.',
      'Implement a React component for a data table with sorting, filtering, and pagination features.',
      'Write a Python class that implements a LRU cache with O(1) operations.',
      'Implement a recursive algorithm in any language to solve the Tower of Hanoi problem.',
      'Create a TypeScript interface and class for a shopping cart system with proper type safety.',
      'Write a function that processes large datasets efficiently using streaming or batch processing.',
      'Implement a graph traversal algorithm (BFS or DFS) to find the shortest path between nodes.',
    ];

    const toolCallingQuestions = [
      'What is the current temperature in New York in fahrenheit?',
      'What is the weather like in San Francisco in celsius?',
      'What flights are departing from SFO right now?',
      'Can you recommend Italian restaurants in New York?',
      'What are the best places to live for good weather?',
    ];

    return {
      essays: essayQuestions,
      summaries: summaryQuestions,
      images: demoIncludeImages ? ['Describe the image'] : [],
      coding: demoIncludeCoding ? codingQuestions : [],
      toolCalling: demoIncludeToolCalling ? toolCallingQuestions : [],
    };
  }, [demoIncludeImages, demoIncludeCoding, demoIncludeToolCalling]);

  const preGenerateQuestions = useCallback(async (count: number): Promise<PregenQuestion[]> => {
    const questions = getDemoQuestions(demoWordCount);
    const availableTypes: QuestionType[] = [];
    if (demoIncludeEssays) availableTypes.push('essay');
    if (demoIncludeSummaries) availableTypes.push('summary');
    if (demoIncludeImages && questions.images.length > 0) availableTypes.push('image');
    if (demoIncludeCoding && questions.coding.length > 0) availableTypes.push('coding');
    if (demoIncludeToolCalling && questions.toolCalling.length > 0) availableTypes.push('toolCalling');
    if (availableTypes.length === 0) availableTypes.push('essay');

    const result: PregenQuestion[] = [];
    const typeCounters: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const type = availableTypes[i % availableTypes.length];
      const idx = typeCounters[type] || 0;
      typeCounters[type] = idx + 1;

      let text: string;
      let imagePath: string | undefined;

      if (type === 'essay') {
        text = questions.essays[idx % questions.essays.length];
      } else if (type === 'summary') {
        text = questions.summaries[idx % questions.summaries.length];
      } else if (type === 'image') {
        text = 'Describe the image';
        const img = await getRandomDemoImage();
        if (img) imagePath = getDemoImageUrl(img);
      } else if (type === 'coding') {
        text = questions.coding[idx % questions.coding.length];
      } else {
        text = questions.toolCalling[idx % questions.toolCalling.length];
      }

      result.push({ text, imagePath, questionType: type });
    }

    return result;
  }, [getDemoQuestions, demoWordCount, demoIncludeEssays, demoIncludeSummaries, demoIncludeImages, demoIncludeCoding, demoIncludeToolCalling]);

  // Wait for a specific pane to finish streaming
  const waitForPaneComplete = useCallback((paneId: string): Promise<void> => {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (!isRacingRef.current) { clearInterval(check); resolve(); return; }
        const pane = panesRef.current.find(p => p.id === paneId);
        if (!pane) { clearInterval(check); resolve(); return; }
        const last = pane.messages[pane.messages.length - 1];
        if (!last?.isStreaming) {
          clearInterval(check);
          resolve();
        }
      }, 300);
    });
  }, []);

  // Convert per-pane results to LapResult[] for the podium
  const buildLapResults = useCallback((): LapResult[] => {
    const lapMap: Record<number, LapResult> = {};
    Object.entries(perPaneLapResultsRef.current).forEach(([paneId, entries]) => {
      entries.forEach(entry => {
        if (!lapMap[entry.lapNumber]) {
          lapMap[entry.lapNumber] = {
            lapNumber: entry.lapNumber,
            questionType: entry.questionType,
            paneMetrics: [],
          };
        }
        lapMap[entry.lapNumber].paneMetrics.push({
          paneId,
          modelName: entry.modelName,
          metrics: entry.metrics,
        });
      });
    });
    return Object.values(lapMap).sort((a, b) => a.lapNumber - b.lapNumber);
  }, []);

  const finishRace = useCallback(() => {
    if (raceFinishedRef.current) return;
    raceFinishedRef.current = true;
    isRacingRef.current = false;
    onDemoStateChange?.(false);

    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    elapsedIntervalRef.current = null;
    tickIntervalRef.current = null;

    const lapResults = buildLapResults();
    setRaceState(prev => ({ ...prev, status: 'finished', lapResults }));
  }, [onDemoStateChange, buildLapResults]);

  // Independent per-model race loop
  const runModelLoop = useCallback(async (paneId: string) => {
    let lapIndex = 0;

    while (isRacingRef.current) {
      const totalLaps = totalLapsRef.current;
      if (totalLaps !== null && lapIndex >= totalLaps) break;

      const question = questionListRef.current[lapIndex];
      if (!question) break;

      perModelLapRef.current[paneId] = lapIndex + 1;

      // Update display lap to the leader's lap
      const maxLap = Math.max(...Object.values(perModelLapRef.current));
      setRaceState(prev => ({ ...prev, currentLap: maxLap }));

      let returnedMetrics: PerformanceMetrics | undefined;
      try {
        returnedMetrics = await sendToPaneRef.current?.(paneId, question.text, question.imagePath, question.questionType);
      } catch {
        break;
      }

      // Wait for this pane's streaming to finish
      await waitForPaneComplete(paneId);

      if (!isRacingRef.current && raceFinishedRef.current) break;

      // Record this pane's lap result using the metrics returned directly
      // from sendMessageToSinglePane (avoids React state timing issues)
      const pane = panesRef.current.find(p => p.id === paneId);
      const metricsToRecord = returnedMetrics || pane?.currentMetrics;
      if (metricsToRecord) {
        if (!perPaneLapResultsRef.current[paneId]) {
          perPaneLapResultsRef.current[paneId] = [];
        }
        perPaneLapResultsRef.current[paneId].push({
          lapNumber: lapIndex + 1,
          questionType: question.questionType,
          modelName: pane?.endpoint.name || 'Unknown',
          metrics: { ...metricsToRecord },
        });
      }

      lapIndex++;

      if (totalLaps !== null && lapIndex >= totalLaps) break;

      // Brief cooldown before next lap
      await new Promise(r => setTimeout(r, 500));
    }

    modelFinishedRef.current[paneId] = true;

    // Check if all models are done
    const allFinished = panesRef.current.every(p => modelFinishedRef.current[p.id]);
    if (allFinished) {
      finishRace();
    }
  }, [waitForPaneComplete, finishRace]);

  const startRace = useCallback(async () => {
    if (panes.length === 0 || !onSendMessageToPane) return;

    onClearChat();

    const totalLaps = limitedRuns ? numberOfRuns : 100;
    const questions = await preGenerateQuestions(totalLaps);
    questionListRef.current = questions;

    perModelLapRef.current = {};
    perPaneLapResultsRef.current = {};
    modelFinishedRef.current = {};
    raceFinishedRef.current = false;

    setRaceState({
      status: 'racing',
      currentLap: 1,
      totalLaps: limitedRuns ? numberOfRuns : null,
      lapResults: [],
    });
    setElapsedTime(0);
    setTick(0);
    raceStartTimeRef.current = Date.now();
    isRacingRef.current = true;
    onDemoStateChange?.(true);

    elapsedIntervalRef.current = window.setInterval(() => {
      setElapsedTime(Date.now() - raceStartTimeRef.current);
    }, 200);

    tickIntervalRef.current = window.setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    // Launch all model loops concurrently (fire-and-forget)
    panes.forEach(pane => {
      runModelLoop(pane.id);
    });
  }, [panes, limitedRuns, numberOfRuns, onClearChat, onDemoStateChange, onSendMessageToPane, preGenerateQuestions, runModelLoop]);

  const stopRace = useCallback(() => {
    isRacingRef.current = false;
    // Give in-progress laps a moment to record, then finish
    setTimeout(() => {
      finishRace();
    }, 1000);
  }, [finishRace]);

  const resetRace = useCallback(() => {
    isRacingRef.current = false;
    raceFinishedRef.current = false;
    onDemoStateChange?.(false);

    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    elapsedIntervalRef.current = null;
    tickIntervalRef.current = null;

    perModelLapRef.current = {};
    perPaneLapResultsRef.current = {};
    modelFinishedRef.current = {};
    questionListRef.current = [];

    onClearChat();
    setRaceState({
      status: 'waiting',
      currentLap: 0,
      totalLaps: limitedRuns ? numberOfRuns : null,
      lapResults: [],
    });
    setElapsedTime(0);
    setTick(0);
  }, [limitedRuns, numberOfRuns, onClearChat, onDemoStateChange]);

  useEffect(() => {
    return () => {
      isRacingRef.current = false;
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  const carData = useMemo(() => {
    void tick;

    const raw = panes.map((pane, i) => {
      const isStreaming = pane.messages.length > 0 && pane.messages[pane.messages.length - 1]?.isStreaming === true;
      const modelLap = perModelLapRef.current[pane.id] || 0;
      const completedLaps = pane.metrics.length;

      let lapFraction = 0;
      if (isStreaming && pane.streamingTokenCount && pane.streamingTokenCount > 0) {
        lapFraction = Math.min(pane.streamingTokenCount / ESTIMATED_TOKENS_PER_LAP, 0.95);
      }

      const progress = raceState.status === 'waiting' ? 0 : completedLaps + lapFraction;

      return {
        id: pane.id,
        modelName: pane.endpoint.name,
        color: CAR_COLORS[i] || '#888',
        progress,
        lap: modelLap,
        position: 0,
        currentMetrics: pane.currentMetrics,
        isStreaming,
      };
    });

    // Rank by cumulative progress; tiebreak by lower total E2E (faster = better)
    const sorted = [...raw].sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      const aPane = panes.find(p => p.id === a.id);
      const bPane = panes.find(p => p.id === b.id);
      const aTotalE2E = aPane?.metrics.reduce((sum, m) => sum + (m.endToEndLatency || 0), 0) || 0;
      const bTotalE2E = bPane?.metrics.reduce((sum, m) => sum + (m.endToEndLatency || 0), 0) || 0;
      return aTotalE2E - bTotalE2E;
    });
    sorted.forEach((car, idx) => {
      const original = raw.find(r => r.id === car.id);
      if (original) original.position = idx + 1;
    });

    return raw;
  }, [panes, raceState, tick]);

  const calculateAverages = useCallback((paneId: string) => {
    const pane = panes.find(p => p.id === paneId);
    if (!pane || pane.metrics.length === 0) return undefined;

    const ttftVals = pane.metrics.map(m => m.timeToFirstToken).filter((v): v is number => v !== undefined);
    const tpsVals = pane.metrics.map(m => m.tokensPerSecond).filter((v): v is number => v !== undefined);
    const e2eVals = pane.metrics.map(m => m.endToEndLatency).filter((v): v is number => v !== undefined);

    return {
      avgTTFT: ttftVals.length > 0 ? ttftVals.reduce((s, v) => s + v, 0) / ttftVals.length : 0,
      avgTPS: tpsVals.length > 0 ? tpsVals.reduce((s, v) => s + v, 0) / tpsVals.length : 0,
      avgE2E: e2eVals.length > 0 ? e2eVals.reduce((s, v) => s + v, 0) / e2eVals.length : 0,
    };
  }, [panes]);

  const rankings = useMemo(() => {
    const withAvg = panes.map(pane => ({
      id: pane.id,
      avgTPS: calculateAverages(pane.id)?.avgTPS || 0,
    })).filter(p => p.avgTPS > 0);

    withAvg.sort((a, b) => b.avgTPS - a.avgTPS);
    const rankMap: Record<string, number> = {};
    withAvg.forEach((p, i) => {
      rankMap[p.id] = i + 1;
    });
    return rankMap;
  }, [panes, calculateAverages]);

  if (raceState.status === 'finished' && raceState.lapResults.length > 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-race-dark relative">
        <RacePodium
          lapResults={raceState.lapResults}
          modelColors={modelColorMap}
          onRaceAgain={resetRace}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-race-dark via-asphalt to-race-dark overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/40 border-b border-gray-800/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          {sidebarCollapsed && (
            <div className="flex items-center gap-2 mr-2">
              <img src="/together-logo.svg" alt="Together AI" className="h-5 w-5" />
              <span className="text-sm font-bold text-gray-300">Together.ai</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-red animate-glow-pulse" />
            <span className="text-sm font-bold text-gray-200 tracking-wide uppercase">Performance Race</span>
          </div>
          <span className="text-xs text-gray-500">
            {panes.length} model{panes.length !== 1 ? 's' : ''}
            {raceState.totalLaps ? ` \u00B7 ${raceState.totalLaps} laps` : ' \u00B7 Unlimited'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {raceState.status === 'waiting' && (
            <motion.button
              onClick={startRace}
              className="flex items-center gap-2 px-5 py-1.5 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold text-sm rounded-lg hover:from-green-500 hover:to-green-400 transition-all shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={panes.length < 1}
            >
              <Flag size={16} />
              Start Race
            </motion.button>
          )}
          {raceState.status === 'racing' && (
            <motion.button
              onClick={stopRace}
              className="flex items-center gap-2 px-5 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm rounded-lg hover:from-red-500 hover:to-red-400 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Square size={16} />
              Stop Race
            </motion.button>
          )}
          {raceState.status === 'finished' && (
            <motion.button
              onClick={resetRace}
              className="flex items-center gap-2 px-5 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw size={16} />
              New Race
            </motion.button>
          )}
        </div>
      </div>

      {/* Race track */}
      <div className="flex-1 min-h-0 px-4 pt-1 pb-1 flex items-center justify-center">
        <RaceTrack
          cars={carData}
          currentLap={raceState.currentLap}
          totalLaps={raceState.totalLaps}
          raceStatus={raceState.status}
          elapsedTime={elapsedTime}
        />
      </div>

      {/* Dashboards */}
      <div className="flex-shrink-0 px-4 pb-2 pt-1">
        <div className={`grid gap-2 ${panes.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : panes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {panes.map((pane, i) => (
            <RaceDashboard
              key={pane.id}
              modelName={pane.endpoint.name}
              carColor={CAR_COLORS[i] || '#888'}
              currentMetrics={pane.currentMetrics}
              averageMetrics={calculateAverages(pane.id)}
              rank={rankings[pane.id]}
              lapCount={pane.metrics.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceView;
