import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Flag, Square, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import RaceTrack from './RaceTrack';
import RaceDashboard from './RaceDashboard';
import RacePodium from './RacePodium';
import { ChatInterfaceProps, RaceState, LapResult } from '../types';
import { getRandomDemoImage, getDemoImageUrl } from '../data/demoImages';

const CAR_COLORS = ['#ef4444', '#3b82f6', '#22c55e'];

const PerformanceView: React.FC<ChatInterfaceProps> = ({
  panes,
  onSendMessage,
  onClearChat,
  demoWordCount,
  demoIncludeEssays,
  demoIncludeSummaries,
  demoIncludeImages,
  demoIncludeCoding,
  demoIncludeToolCalling,
  demoQuestionDelay,
  demoSubmitDelay,
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
  const raceStartTimeRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<number | null>(null);
  const isRacingRef = useRef(false);
  const scheduleIntervalRef = useRef<number | null>(null);
  const demoTimeoutRef = useRef<number | null>(null);
  const questionTypeRef = useRef<'essay' | 'summary' | 'image' | 'coding' | 'toolCalling'>('essay');
  const prevMetricsLengthRef = useRef<number[]>([]);

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

  const getRandomQuestion = useCallback(async () => {
    const questions = getDemoQuestions(demoWordCount);
    const availableTypes: ('essay' | 'summary' | 'image' | 'coding' | 'toolCalling')[] = [];
    if (demoIncludeEssays) availableTypes.push('essay');
    if (demoIncludeSummaries) availableTypes.push('summary');
    if (demoIncludeImages && questions.images.length > 0) availableTypes.push('image');
    if (demoIncludeCoding && questions.coding.length > 0) availableTypes.push('coding');
    if (demoIncludeToolCalling && questions.toolCalling.length > 0) availableTypes.push('toolCalling');

    if (availableTypes.length === 0) availableTypes.push('essay');

    const currentIndex = availableTypes.indexOf(questionTypeRef.current);
    const nextType = currentIndex === -1
      ? availableTypes[0]
      : availableTypes[(currentIndex + 1) % availableTypes.length];
    questionTypeRef.current = nextType;

    let text: string;
    let imagePath: string | undefined;

    if (nextType === 'essay') {
      text = questions.essays[Math.floor(Math.random() * questions.essays.length)];
    } else if (nextType === 'summary') {
      text = questions.summaries[Math.floor(Math.random() * questions.summaries.length)];
    } else if (nextType === 'image') {
      text = 'Describe the image';
      const img = await getRandomDemoImage();
      if (img) imagePath = getDemoImageUrl(img);
    } else if (nextType === 'coding') {
      text = questions.coding[Math.floor(Math.random() * questions.coding.length)];
    } else {
      text = questions.toolCalling[Math.floor(Math.random() * questions.toolCalling.length)];
    }

    return { text, imagePath, questionType: nextType };
  }, [getDemoQuestions, demoWordCount, demoIncludeEssays, demoIncludeSummaries, demoIncludeImages, demoIncludeCoding, demoIncludeToolCalling]);

  const recordLapResult = useCallback(() => {
    setRaceState(prev => {
      const lapMetrics = panes.map(pane => ({
        paneId: pane.id,
        modelName: pane.endpoint.name,
        metrics: pane.currentMetrics || {},
      }));
      const newLap: LapResult = {
        lapNumber: prev.currentLap,
        questionType: questionTypeRef.current,
        paneMetrics: lapMetrics,
      };
      return {
        ...prev,
        lapResults: [...prev.lapResults, newLap],
      };
    });
  }, [panes]);

  const scheduleNextLap = useCallback(() => {
    if (scheduleIntervalRef.current) {
      clearInterval(scheduleIntervalRef.current);
      scheduleIntervalRef.current = null;
    }

    const intervalId = setInterval(async () => {
      if (!isRacingRef.current) {
        clearInterval(intervalId);
        scheduleIntervalRef.current = null;
        return;
      }

      const anyStreaming = panes.some(pane => {
        if (pane.messages.length === 0) return false;
        const last = pane.messages[pane.messages.length - 1];
        return last?.isStreaming === true;
      });

      if (!anyStreaming && isRacingRef.current && panes.length > 0) {
        clearInterval(intervalId);
        scheduleIntervalRef.current = null;

        recordLapResult();

        setRaceState(prev => {
          const newLapCount = prev.currentLap;
          if (prev.totalLaps !== null && newLapCount >= prev.totalLaps) {
            isRacingRef.current = false;
            onDemoStateChange?.(false);
            if (elapsedIntervalRef.current) {
              clearInterval(elapsedIntervalRef.current);
              elapsedIntervalRef.current = null;
            }
            return { ...prev, status: 'finished' };
          }
          return prev;
        });

        // Small delay then check if we should continue
        demoTimeoutRef.current = window.setTimeout(async () => {
          if (!isRacingRef.current) return;

          const question = await getRandomQuestion();
          setRaceState(prev => ({ ...prev, currentLap: prev.currentLap + 1 }));

          demoTimeoutRef.current = window.setTimeout(async () => {
            if (!isRacingRef.current) return;
            try {
              await onSendMessage(question.text, question.imagePath, question.questionType);
              scheduleNextLap();
            } catch {
              stopRace();
            }
          }, demoSubmitDelay * 1000);
        }, demoQuestionDelay * 1000);
      }
    }, 1000);

    scheduleIntervalRef.current = intervalId;
  }, [panes, recordLapResult, getRandomQuestion, onSendMessage, demoQuestionDelay, demoSubmitDelay, onDemoStateChange]);

  const startRace = useCallback(async () => {
    if (panes.length === 0) return;

    onClearChat();

    setRaceState({
      status: 'racing',
      currentLap: 1,
      totalLaps: limitedRuns ? numberOfRuns : null,
      lapResults: [],
    });
    setElapsedTime(0);
    raceStartTimeRef.current = Date.now();
    isRacingRef.current = true;
    prevMetricsLengthRef.current = panes.map(() => 0);
    onDemoStateChange?.(true);

    elapsedIntervalRef.current = window.setInterval(() => {
      setElapsedTime(Date.now() - raceStartTimeRef.current);
    }, 200);

    const question = await getRandomQuestion();

    demoTimeoutRef.current = window.setTimeout(async () => {
      if (!isRacingRef.current) return;
      try {
        await onSendMessage(question.text, question.imagePath, question.questionType);
        scheduleNextLap();
      } catch {
        stopRace();
      }
    }, demoSubmitDelay * 1000);
  }, [panes, limitedRuns, numberOfRuns, onClearChat, onDemoStateChange, getRandomQuestion, onSendMessage, demoSubmitDelay, scheduleNextLap]);

  const stopRace = useCallback(() => {
    isRacingRef.current = false;
    onDemoStateChange?.(false);

    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
    if (scheduleIntervalRef.current) {
      clearInterval(scheduleIntervalRef.current);
      scheduleIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    recordLapResult();
    setRaceState(prev => ({ ...prev, status: 'finished' }));
  }, [onDemoStateChange, recordLapResult]);

  const resetRace = useCallback(() => {
    isRacingRef.current = false;
    onDemoStateChange?.(false);

    if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    if (scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    demoTimeoutRef.current = null;
    scheduleIntervalRef.current = null;
    elapsedIntervalRef.current = null;

    onClearChat();
    setRaceState({
      status: 'waiting',
      currentLap: 0,
      totalLaps: limitedRuns ? numberOfRuns : null,
      lapResults: [],
    });
    setElapsedTime(0);
  }, [limitedRuns, numberOfRuns, onClearChat, onDemoStateChange]);

  useEffect(() => {
    return () => {
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
      if (scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  const carData = useMemo(() => {
    return panes.map((pane, i) => {
      const isStreaming = pane.messages.length > 0 && pane.messages[pane.messages.length - 1]?.isStreaming === true;
      const lapsDone = pane.metrics.length;
      const baseProgress = lapsDone;
      const streamingProgress = isStreaming ? 0.5 : (pane.currentMetrics?.endToEndLatency ? 1 : 0);
      const totalProgress = raceState.status === 'waiting' ? 0 : (baseProgress + streamingProgress) / Math.max(raceState.totalLaps || raceState.currentLap || 1, 1);

      return {
        id: pane.id,
        modelName: pane.endpoint.name,
        color: CAR_COLORS[i] || '#888',
        progress: Math.min(totalProgress, 1),
        lap: lapsDone + (isStreaming ? 1 : 0),
        currentMetrics: pane.currentMetrics,
        isStreaming,
      };
    });
  }, [panes, raceState]);

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
      <div className="flex-1 flex flex-col h-screen bg-race-dark relative">
        <RacePodium
          lapResults={raceState.lapResults}
          modelColors={modelColorMap}
          onRaceAgain={resetRace}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gradient-to-b from-race-dark via-asphalt to-race-dark overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-gray-800/60 flex-shrink-0">
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
            {raceState.totalLaps ? ` - ${raceState.totalLaps} laps` : ' - Unlimited'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {raceState.status === 'waiting' && (
            <motion.button
              onClick={startRace}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold text-sm rounded-lg hover:from-green-500 hover:to-green-400 transition-all shadow-lg"
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
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm rounded-lg hover:from-red-500 hover:to-red-400 transition-all"
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
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw size={16} />
              New Race
            </motion.button>
          )}
        </div>
      </div>

      {/* Race track -- constrained to upper portion of screen */}
      <div className="flex-1 min-h-0 px-4 pt-2 flex items-center justify-center">
        <div className="w-full max-h-full">
          <RaceTrack
            cars={carData}
            currentLap={raceState.currentLap}
            totalLaps={raceState.totalLaps}
            raceStatus={raceState.status}
            elapsedTime={elapsedTime}
          />
        </div>
      </div>

      {/* Dashboards -- compact, pinned to bottom */}
      <div className="flex-shrink-0 px-4 pb-3 pt-2">
        <div className={`grid gap-3 ${panes.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : panes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
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
