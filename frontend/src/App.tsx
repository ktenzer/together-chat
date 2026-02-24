import { useState, useEffect } from 'react';
import { Globe, MessageSquare, Plus, Trash2, Key, Minus, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import EndpointManager from './components/EndpointManager';
import ChatInterface from './components/ChatInterface';
import PerformanceView from './components/PerformanceView';
import ApiKeyManager from './components/ApiKeyManager';
import DemoConfig from './components/DemoConfig';
import { endpointsAPI, sessionsAPI, apiKeysAPI, platformsAPI } from './services/api';
import { Endpoint, ChatSession, ApiKey, Platform, ChatPane, ChatMessage, PerformanceMetrics } from './types';

function App(): JSX.Element {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<Endpoint | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [chatPanes, setChatPanes] = useState<ChatPane[]>([]);
  const [showEndpointManager, setShowEndpointManager] = useState<boolean>(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState<boolean>(false);
  const [showDemoConfig, setShowDemoConfig] = useState<boolean>(false);
  const [demoWordCount, setDemoWordCount] = useState<number>(250);
  const [demoIncludeEssays, setDemoIncludeEssays] = useState<boolean>(true);
  const [demoIncludeSummaries, setDemoIncludeSummaries] = useState<boolean>(true);
  const [demoIncludeImages, setDemoIncludeImages] = useState<boolean>(false);
  const [demoIncludeCoding, setDemoIncludeCoding] = useState<boolean>(false);
  const [demoIncludeToolCalling, setDemoIncludeToolCalling] = useState<boolean>(false);
  const [demoQuestionDelay, setDemoQuestionDelay] = useState<number>(5); // seconds before showing question
  const [demoSubmitDelay, setDemoSubmitDelay] = useState<number>(5); // seconds before submitting question
  const [performanceMode, setPerformanceMode] = useState<boolean>(false);
  const [limitedRuns, setLimitedRuns] = useState<boolean>(false);
  const [numberOfRuns, setNumberOfRuns] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  const handleDemoStateChange = (isActive: boolean): void => {
    setSidebarCollapsed(isActive); // Collapse sidebar when demo starts, expand when it stops
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const [useHistory, setUseHistory] = useState<boolean>(true);

  const loadInitialData = async (): Promise<void> => {
    try {
      const [endpointsRes, sessionsRes, apiKeysRes, platformsRes] = await Promise.all([
        endpointsAPI.getAll(),
        sessionsAPI.getAll(),
        apiKeysAPI.getAll(),
        platformsAPI.getAll(),
      ]);
      
      setEndpoints(endpointsRes.data);
      setSessions(sessionsRes.data);
      setApiKeys(apiKeysRes.data);
      setPlatforms(platformsRes.data);
      
      // Set default endpoint if available
      if (endpointsRes.data.length > 0 && !currentEndpoint) {
        setCurrentEndpoint(endpointsRes.data[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMessages = async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch(`http://localhost:3001/api/sessions/${sessionId}/messages`);
      if (response.ok) {
        const messages = await response.json();
        // Update the current pane with the loaded messages if there's one pane
        if (chatPanes.length === 1) {
          setChatPanes(prev => prev.map(pane => ({
            ...pane,
            messages: messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              image_path: msg.image_path,
              timestamp: msg.timestamp,
              isStreaming: false
            }))
          })));
        }
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
    }
  };

  const handleEndpointChange = (endpoint: Endpoint | null): void => {
    setCurrentEndpoint(endpoint);
    
    if (endpoint) {
      // Filter sessions for this specific endpoint
      const endpointSessions = sessions.filter(session => session.endpoint_id === endpoint.id);
      
      // If there are existing sessions for this endpoint, use the most recent one
      if (endpointSessions.length > 0) {
        const mostRecentSession = endpointSessions[0]; // Sessions are already sorted by created_at DESC
        setCurrentSession(mostRecentSession);
        
        // Load messages for this session if we're in single pane mode
        if (chatPanes.length === 1) {
          loadSessionMessages(mostRecentSession.id);
        }
      } else {
        // No sessions for this endpoint, clear current session but don't create a new one
        setCurrentSession(null);
        // Clear messages in single pane mode
        if (chatPanes.length === 1) {
          setChatPanes(prev => prev.map(pane => ({ ...pane, messages: [], session: null })));
        }
      }
    } else {
      setCurrentSession(null);
    }
  };

  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    try {
      await sessionsAPI.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        // Clear the session from the current pane but keep the pane
        if (chatPanes.length === 1) {
          setChatPanes(prev => prev.map(pane => ({
            ...pane,
            session: null,
            messages: []
          })));
        } else {
          // For multi-pane mode, remove all panes as before
          setChatPanes([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const addChatPane = async (): Promise<void> => {
    if (chatPanes.length >= 3 || endpoints.length === 0) return;

    // Use the first available endpoint if no panes exist, otherwise use the first endpoint
    const defaultEndpoint = endpoints[0];
    if (!defaultEndpoint) return;

    try {
      let sessionToUse: ChatSession | null = null;

      if (chatPanes.length === 0) {
        // Single pane mode - check if there's an existing session for this endpoint
        const endpointSessions = sessions.filter(session => session.endpoint_id === defaultEndpoint.id);
        if (endpointSessions.length > 0) {
          // Use the most recent session
          sessionToUse = endpointSessions[0];
        }
        // Don't create a session automatically - user will create one manually
      } else {
        // Multi-pane mode - create temporary session (not saved to database)
        sessionToUse = {
          id: `temp-${Date.now()}-${Math.random()}`,
          endpoint_id: defaultEndpoint.id,
          name: `Temp Session ${chatPanes.length + 1}`,
          created_at: new Date().toISOString()
        };
      }

      const paneTitle = `Pane ${chatPanes.length + 1}`;

      const newPane: ChatPane = {
        id: `pane-${Date.now()}`,
        endpoint: defaultEndpoint,
        session: sessionToUse,
        title: paneTitle,
        messages: [],
        metrics: [],
        currentMetrics: undefined
      };

      setChatPanes(prev => [...prev, newPane]);
      
      if (chatPanes.length === 0) {
        setCurrentEndpoint(defaultEndpoint);
        setCurrentSession(sessionToUse);
        
        // Load existing messages if we're using an existing session
        if (sessionToUse && !sessionToUse.id.startsWith('temp-')) {
          loadSessionMessages(sessionToUse.id);
        }
      }
    } catch (error) {
      console.error('Error creating pane:', error);
    }
  };

  const removeChatPane = (paneId: string): void => {
    setChatPanes(prev => prev.filter(pane => pane.id !== paneId));
  };

  const updatePaneEndpoint = async (paneId: string, endpoint: Endpoint): Promise<void> => {
    const currentPane = chatPanes.find(p => p.id === paneId);
    if (!currentPane) return;

    // If this is the only pane, update the main endpoint
    if (chatPanes.length === 1) {
      setCurrentEndpoint(endpoint);
      
      // Check if there are existing sessions for this endpoint
      const endpointSessions = sessions.filter(session => session.endpoint_id === endpoint.id);
      
      if (endpointSessions.length > 0) {
        // Use the most recent session for this endpoint
        const mostRecentSession = endpointSessions[0];
        setCurrentSession(mostRecentSession);
        
        setChatPanes(prev => prev.map(pane => 
          pane.id === paneId ? { ...pane, endpoint, session: mostRecentSession, messages: [] } : pane
        ));
        
        // Load messages for this session
        loadSessionMessages(mostRecentSession.id);
      } else {
        // No sessions for this endpoint - clear session and messages
        setCurrentSession(null);
        setChatPanes(prev => prev.map(pane => 
          pane.id === paneId ? { ...pane, endpoint, session: null, messages: [] } : pane
        ));
      }
    } else {
      // Multi-pane mode - just update endpoint with temporary session
      const tempSession: ChatSession = {
        id: `temp-${Date.now()}-${Math.random()}`,
        endpoint_id: endpoint.id,
        name: `Temp Session`,
        created_at: new Date().toISOString()
      };
      
      setChatPanes(prev => prev.map(pane => 
        pane.id === paneId ? { ...pane, endpoint, session: tempSession, messages: [] } : pane
      ));
    }
  };

  const sendMessageToAllPanes = async (message: string, imagePath?: string, questionType?: 'essay' | 'summary' | 'image' | 'coding' | 'toolCalling'): Promise<void> => {
    if (chatPanes.length === 0) return;

    // Utility function to estimate token count from text
    const estimateTokenCount = (text: string): number => {
      // Simple approximation: ~1.3 tokens per word for English text
      const words = text.trim().split(/\s+/).length;
      return Math.round(words * 1.3);
    };

    // Detect if this is a tool calling question
    const isToolCallingQuestion = (msg: string): boolean => {
      const lowerMsg = msg.toLowerCase();
      
      // Weather-related keywords
      const weatherKeywords = ['weather', 'temperature', 'forecast', 'climate', 'hot', 'cold', 'rain', 'snow', 'fahrenheit', 'celsius'];
      
      // Flight-related keywords
      const flightKeywords = ['flight', 'flights', 'departing', 'departure', 'airport', 'sfo', 'jfk', 'lax', 'ord', 'atl'];
      
      // Restaurant-related keywords
      const restaurantKeywords = ['restaurant', 'restaurants', 'italian', 'japanese', 'french', 'mexican', 'chinese', 'cuisine', 'dining', 'eat'];
      
      // Best places to live keywords
      const placesKeywords = ['best place', 'best city', 'best cities', 'places to live', 'where to live', 'cost of living', 'safest cities'];
      
      return weatherKeywords.some(keyword => lowerMsg.includes(keyword)) ||
             flightKeywords.some(keyword => lowerMsg.includes(keyword)) ||
             restaurantKeywords.some(keyword => lowerMsg.includes(keyword)) ||
             placesKeywords.some(keyword => lowerMsg.includes(keyword));
    };

    // Determine if tools should be used:
    // - If questionType is provided (demo mode), only use tools if it's 'toolCalling'
    // - If questionType is not provided (manual input), use tools if enabled AND keywords match
    const useTools = demoIncludeToolCalling && (
      questionType ? questionType === 'toolCalling' : isToolCallingQuestion(message)
    );

    // For multi-pane mode (2+), clear previous messages but keep metrics for aggregation
    const shouldClearHistory = chatPanes.length >= 2;
    
    // Clear current pane metrics (will be repopulated with new response metrics)
    // but preserve historical metrics for aggregation
    setChatPanes(prevPanes => 
      prevPanes.map(pane => ({
        ...pane,
        messages: shouldClearHistory ? [] : pane.messages,
        metrics: pane.metrics, // Preserve all historical metrics
        currentMetrics: undefined // Clear current run metrics to show "--"
      }))
    );

    // Add user message to all panes
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      image_path: imagePath,
      timestamp: new Date().toISOString()
    };

    setChatPanes(prev => prev.map(pane => ({
      ...pane,
      messages: [...(shouldClearHistory ? [] : pane.messages), userMessage]
    })));

    // Send requests to all panes in parallel
    const promises = chatPanes.map(async (pane) => {
      const metrics: PerformanceMetrics = {
        requestStartTime: Date.now()
      };

      try {
        // Check if this is a thinking model (GPT-5 or Together AI thinking models)
        const isThinkingModel = pane.endpoint.model.includes('gpt-5') ||
                                pane.endpoint.model.toLowerCase().includes('think') || 
                                pane.endpoint.model.toLowerCase().includes('r1') ||
                                pane.endpoint.model.toLowerCase().includes('cogito');
        
        const assistantMessage: ChatMessage = {
          id: `assistant-${pane.id}-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          isThinkingModel: isThinkingModel
        };

        // Add streaming message
        setChatPanes(prev => prev.map(p => 
          p.id === pane.id 
            ? { ...p, messages: [...p.messages, assistantMessage] }
            : p
        ));

        // Create an AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 320000); // 5 minutes 20 seconds (slightly longer than backend timeout)

        const response = await fetch('http://localhost:3001/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint_id: pane.endpoint.id,
            session_id: pane.session?.id?.startsWith('temp-') ? null : pane.session?.id || null,
            message: message,
            image_path: imagePath,
            use_history: chatPanes.length === 1 ? useHistory : false,
            save_to_db: chatPanes.length === 1,
            use_tools: useTools
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        let accumulatedContent = '';
        let accumulatedThinking = ''; // For thinking models
        let accumulatedAnswer = ''; // For thinking models
        let firstTokenReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                metrics.requestEndTime = Date.now();
                metrics.endToEndLatency = metrics.requestEndTime - (metrics.requestStartTime || 0);
                
                // Calculate TPS metrics - only count answer tokens for fair comparison
                // For thinking models, use accumulatedAnswer (excludes thinking tokens)
                // For non-thinking models, use accumulatedContent (which is the answer)
                const answerContent = accumulatedAnswer.length > 0 ? accumulatedAnswer : accumulatedContent;
                metrics.totalTokens = estimateTokenCount(answerContent);
                metrics.generationTime = metrics.requestEndTime - (metrics.firstTokenTime || metrics.requestStartTime || 0);
                metrics.tokensPerSecond = metrics.generationTime > 0 ? (metrics.totalTokens / metrics.generationTime) * 1000 : 0;
                
                break;
              }

              if (data.startsWith('ERROR:')) {
                // Handle error
                setChatPanes(prev => prev.map(p => 
                  p.id === pane.id 
                    ? { 
                        ...p, 
                        messages: p.messages.map(m => 
                          m.id === assistantMessage.id 
                            ? { ...m, content: data, isStreaming: false, isError: true }
                            : m
                        )
                      }
                    : p
                ));
                return;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'BACKEND_TTFT') {
                  metrics.timeToFirstToken = parsed.ttft;
                  metrics.firstTokenTime = Date.now();
                  firstTokenReceived = true;
                  continue;
                }
                
                if (parsed.type === 'METRICS' && (parsed.isReasoningModel || parsed.isThinkingModel)) {
              if (!firstTokenReceived) {
                metrics.firstTokenTime = Date.now();
                metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                firstTokenReceived = true;
              }
                  continue;
                }
                
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  const deltaContent = parsed.choices[0].delta.content;
                  const contentType = parsed.choices[0].delta.contentType;
                  
                  if (!firstTokenReceived) {
                    metrics.firstTokenTime = Date.now();
                    metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                    firstTokenReceived = true;
                  }
                  
                  accumulatedContent += deltaContent;
                  
                  // Track thinking vs answer content separately for thinking models
                  if (contentType === 'thinking') {
                    accumulatedThinking += deltaContent;
                  } else if (contentType === 'answer') {
                    accumulatedAnswer += deltaContent;
                  }
                  
                  // Live token estimate for race car progress
                  const answerSoFar = accumulatedAnswer.length > 0 ? accumulatedAnswer : accumulatedContent;
                  const liveTokenCount = Math.round(answerSoFar.trim().split(/\s+/).length * 1.3);

                  // Live in-progress metrics for gauges
                  const now = Date.now();
                  const liveMetrics: PerformanceMetrics = {
                    requestStartTime: metrics.requestStartTime,
                    firstTokenTime: metrics.firstTokenTime,
                    timeToFirstToken: metrics.timeToFirstToken,
                    totalTokens: liveTokenCount,
                    generationTime: metrics.firstTokenTime ? now - metrics.firstTokenTime : undefined,
                    tokensPerSecond: metrics.firstTokenTime && (now - metrics.firstTokenTime) > 0
                      ? (liveTokenCount / (now - metrics.firstTokenTime)) * 1000
                      : undefined,
                  };

                  // Update message content + live streaming data
                  setChatPanes(prev => prev.map(p => 
                    p.id === pane.id 
                      ? { 
                          ...p,
                          streamingTokenCount: liveTokenCount,
                          currentMetrics: {
                            ...liveMetrics,
                            endToEndLatency: p.currentMetrics?.endToEndLatency,
                          },
                          messages: p.messages.map(m => 
                            m.id === assistantMessage.id 
                              ? { 
                                  ...m, 
                                  content: contentType ? accumulatedAnswer : accumulatedContent,
                                  thinkingContent: accumulatedThinking.length > 0 ? accumulatedThinking : m.thinkingContent,
                                  isAnswerPhase: contentType === 'answer' || accumulatedAnswer.length > 0
                                }
                              : m
                          )
                        }
                      : p
                  ));
                }
              } catch (e) {
                // Ignore JSON parsing errors for malformed chunks
                console.warn('Failed to parse streaming chunk:', data);
              }
            } else if (line.startsWith('PROGRESS:')) {
              const progressMessage = line.slice(9);
              if (!firstTokenReceived) {
                metrics.firstTokenTime = Date.now();
                metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                firstTokenReceived = true;
              }
              
              setChatPanes(prev => prev.map(p => 
                p.id === pane.id 
                  ? { 
                      ...p, 
                      messages: p.messages.map(m => 
                        m.id === assistantMessage.id 
                          ? { ...m, content: progressMessage }
                          : m
                      )
                    }
                  : p
              ));
            } else if (line.startsWith('COMPLETE:')) {
              // Handle image generation completion
              try {
                const completionData = JSON.parse(line.slice(9));
                metrics.requestEndTime = Date.now();
                metrics.endToEndLatency = metrics.requestEndTime - (metrics.requestStartTime || 0);
                
                // For image generation, we don't calculate TPS as it's not text tokens
                metrics.totalTokens = 0;
                metrics.generationTime = metrics.requestEndTime - (metrics.firstTokenTime || metrics.requestStartTime || 0);
                metrics.tokensPerSecond = 0;
                
                setChatPanes(prev => prev.map(p => 
                  p.id === pane.id 
                    ? { 
                        ...p, 
                        messages: p.messages.map(m => 
                          m.id === assistantMessage.id 
                            ? { 
                                ...m, 
                                content: completionData.content, 
                                image_path: completionData.image_path,
                                isStreaming: false 
                              }
                            : m
                        )
                      }
                    : p
                ));
                break;
              } catch (e) {
                console.warn('Failed to parse completion data:', line);
              }
            } else if (line.startsWith('ERROR:')) {
              // Handle error
              const errorMessage = line.slice(6);
              setChatPanes(prev => prev.map(p => 
                p.id === pane.id 
                  ? { 
                      ...p, 
                      messages: p.messages.map(m => 
                        m.id === assistantMessage.id 
                          ? { ...m, content: errorMessage, isStreaming: false, isError: true }
                          : m
                      )
                    }
                  : p
              ));
              return;
            }
          }
        }

        // Mark as complete and add metrics
        setChatPanes(prev => prev.map(p => 
          p.id === pane.id 
            ? { 
                ...p, 
                streamingTokenCount: 0,
                messages: p.messages.map(m => 
                  m.id === assistantMessage.id 
                    ? { ...m, isStreaming: false }
                    : m
                ),
                metrics: [...p.metrics, metrics],
                currentMetrics: metrics
              }
            : p
        ));

      } catch (error) {
        console.error(`Error in pane ${pane.id}:`, error);
        
        // Determine error message based on error type
        let errorMessage = `Error: ${error}`;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = '⏱️ Request timed out. The model took too long to respond. Please try again.';
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = '🌐 Network error. Please check your connection and try again.';
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }
        
        // Update with error message
        setChatPanes(prev => prev.map(p => 
          p.id === pane.id 
            ? { 
                ...p, 
                messages: p.messages.map(m => 
                  m.id.startsWith(`assistant-${pane.id}`) && m.isStreaming
                    ? { ...m, content: errorMessage, isStreaming: false, isError: true }
                    : m
                )
              }
            : p
        ));
      }
    });

    await Promise.all(promises);
  };

  const sendMessageToSinglePane = async (
    paneId: string,
    message: string,
    imagePath?: string,
    questionType?: 'essay' | 'summary' | 'image' | 'coding' | 'toolCalling'
  ): Promise<PerformanceMetrics | undefined> => {
    const pane = chatPanes.find(p => p.id === paneId);
    if (!pane) return undefined;

    const estimateTokenCount = (text: string): number => {
      const words = text.trim().split(/\s+/).length;
      return Math.round(words * 1.3);
    };

    const useTools = demoIncludeToolCalling && questionType === 'toolCalling';

    setChatPanes(prev => prev.map(p =>
      p.id === paneId
        ? { ...p, messages: [], streamingTokenCount: 0 }
        : p
    ));

    const userMessage: ChatMessage = {
      id: `user-${paneId}-${Date.now()}`,
      role: 'user',
      content: message,
      image_path: imagePath,
      timestamp: new Date().toISOString()
    };

    setChatPanes(prev => prev.map(p =>
      p.id === paneId ? { ...p, messages: [userMessage] } : p
    ));

    const metrics: PerformanceMetrics = {};

    try {
      const isThinkingModel = pane.endpoint.model.includes('gpt-5') ||
                              pane.endpoint.model.toLowerCase().includes('think') ||
                              pane.endpoint.model.toLowerCase().includes('r1') ||
                              pane.endpoint.model.toLowerCase().includes('cogito');

      const assistantMessage: ChatMessage = {
        id: `assistant-${paneId}-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        isThinkingModel
      };

      setChatPanes(prev => prev.map(p =>
        p.id === paneId
          ? { ...p, messages: [...p.messages, assistantMessage] }
          : p
      ));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 320000);

      metrics.requestStartTime = Date.now();
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_id: pane.endpoint.id,
          session_id: null,
          message,
          image_path: imagePath,
          use_history: false,
          save_to_db: false,
          use_tools: useTools
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let accumulatedContent = '';
      let accumulatedThinking = '';
      let accumulatedAnswer = '';
      let firstTokenReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              metrics.requestEndTime = Date.now();
              metrics.endToEndLatency = metrics.requestEndTime - (metrics.requestStartTime || 0);
              const answerContent = accumulatedAnswer.length > 0 ? accumulatedAnswer : accumulatedContent;
              metrics.totalTokens = estimateTokenCount(answerContent);
              metrics.generationTime = metrics.requestEndTime - (metrics.firstTokenTime || metrics.requestStartTime || 0);
              metrics.tokensPerSecond = metrics.generationTime > 0 ? (metrics.totalTokens / metrics.generationTime) * 1000 : 0;
              break;
            }

            if (data.startsWith('ERROR:')) {
              setChatPanes(prev => prev.map(p =>
                p.id === paneId
                  ? { ...p, messages: p.messages.map(m => m.id === assistantMessage.id ? { ...m, content: data, isStreaming: false, isError: true } : m) }
                  : p
              ));
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'BACKEND_TTFT') {
                metrics.timeToFirstToken = parsed.ttft;
                metrics.firstTokenTime = Date.now();
                firstTokenReceived = true;
                continue;
              }

              if (parsed.type === 'METRICS' && (parsed.isReasoningModel || parsed.isThinkingModel)) {
                if (!firstTokenReceived) {
                  metrics.firstTokenTime = Date.now();
                  metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                  firstTokenReceived = true;
                }
                continue;
              }

              if (parsed.choices?.[0]?.delta?.content) {
                const deltaContent = parsed.choices[0].delta.content;
                const contentType = parsed.choices[0].delta.contentType;

                if (!firstTokenReceived) {
                  metrics.firstTokenTime = Date.now();
                  metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                  firstTokenReceived = true;
                }

                accumulatedContent += deltaContent;
                if (contentType === 'thinking') accumulatedThinking += deltaContent;
                else if (contentType === 'answer') accumulatedAnswer += deltaContent;

                const answerSoFar = accumulatedAnswer.length > 0 ? accumulatedAnswer : accumulatedContent;
                const liveTokenCount = Math.round(answerSoFar.trim().split(/\s+/).length * 1.3);

                const now = Date.now();
                const liveMetrics: PerformanceMetrics = {
                  requestStartTime: metrics.requestStartTime,
                  firstTokenTime: metrics.firstTokenTime,
                  timeToFirstToken: metrics.timeToFirstToken,
                  totalTokens: liveTokenCount,
                  generationTime: metrics.firstTokenTime ? now - metrics.firstTokenTime : undefined,
                  tokensPerSecond: metrics.firstTokenTime && (now - metrics.firstTokenTime) > 0
                    ? (liveTokenCount / (now - metrics.firstTokenTime)) * 1000
                    : undefined,
                };

                setChatPanes(prev => prev.map(p =>
                  p.id === paneId
                    ? {
                        ...p,
                        streamingTokenCount: liveTokenCount,
                        currentMetrics: {
                          ...liveMetrics,
                          endToEndLatency: p.currentMetrics?.endToEndLatency,
                        },
                        messages: p.messages.map(m =>
                          m.id === assistantMessage.id
                            ? {
                                ...m,
                                content: contentType ? accumulatedAnswer : accumulatedContent,
                                thinkingContent: accumulatedThinking.length > 0 ? accumulatedThinking : m.thinkingContent,
                                isAnswerPhase: contentType === 'answer' || accumulatedAnswer.length > 0
                              }
                            : m
                        )
                      }
                    : p
                ));
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      const finalMetrics = { ...metrics };
      setChatPanes(prev => prev.map(p =>
        p.id === paneId
          ? {
              ...p,
              streamingTokenCount: 0,
              messages: p.messages.map(m => m.id === assistantMessage.id ? { ...m, isStreaming: false } : m),
              metrics: [...p.metrics, finalMetrics],
              currentMetrics: finalMetrics
            }
          : p
      ));

      return metrics;
    } catch (error) {
      console.error(`Error in pane ${paneId}:`, error);
      let errorMessage = `Error: ${error}`;
      if (error instanceof Error) {
        if (error.name === 'AbortError') errorMessage = 'Request timed out.';
        else if (error.message.includes('Failed to fetch')) errorMessage = 'Network error.';
        else errorMessage = `Error: ${error.message}`;
      }
      setChatPanes(prev => prev.map(p =>
        p.id === paneId
          ? { ...p, messages: p.messages.map(m => m.id.startsWith(`assistant-${paneId}`) && m.isStreaming ? { ...m, content: errorMessage, isStreaming: false, isError: true } : m) }
          : p
      ));
      return undefined;
    }
  };

  const clearAllChats = (): void => {
    setChatPanes(prev => prev.map(pane => ({
      ...pane,
      messages: [],
      metrics: [],
      currentMetrics: undefined,
      streamingTokenCount: 0
    })));
  };

  const handleSessionSelect = (session: ChatSession): void => {
    setCurrentSession(session);
    
    // Load messages for this session if we're in single pane mode
    if (chatPanes.length === 1) {
      loadSessionMessages(session.id);
    }
  };

  const createNewSession = async (): Promise<void> => {
    if (!currentEndpoint) return;
    
    try {
      const response = await sessionsAPI.create({
        endpoint_id: currentEndpoint.id,
        name: `Chat ${new Date().toLocaleString()}`,
      });
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      
      // Clear current pane messages and update session
      if (chatPanes.length === 1) {
        setChatPanes(prev => prev.map(pane => ({
          ...pane,
          session: newSession,
          messages: []
        })));
      }
    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const filteredSessions = sessions.filter(session => 
    currentEndpoint ? session.endpoint_id === currentEndpoint.id : false
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Collapsible */}
      <div 
        className={`bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 h-screen z-20 transition-all duration-300 ${
          sidebarCollapsed ? 'w-0' : 'w-80'
        }`}
        style={{ 
          overflow: 'hidden',
          overflowX: 'hidden',
          maxWidth: sidebarCollapsed ? '0px' : '320px',
          minWidth: sidebarCollapsed ? '0px' : '320px',
          width: sidebarCollapsed ? '0px' : '320px'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <img src="/together-logo.svg" alt="Together AI" className="h-6 w-6 mr-2" />
              Together Chat
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowDemoConfig(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title="Configure Demo"
              >
                <Rocket className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowEndpointManager(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title="Manage Endpoints"
              >
                <Globe className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowApiKeyManager(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title="Manage API Keys"
              >
                <Key className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Add Chat Pane Button */}
          <button
            onClick={() => addChatPane().catch(console.error)}
            disabled={endpoints.length === 0 || chatPanes.length >= 3}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chat Pane ({chatPanes.length}/3)
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ width: '320px' }}>
          {/* Chat Panes Management */}
          {chatPanes.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Active Panes</h3>
              <div className="space-y-2">
                {chatPanes.map((pane, index) => {
                  const selectedEndpoint = endpoints.find(ep => ep.id === pane.endpoint.id);
                  const displayName = selectedEndpoint?.name || '';
                  const truncatedName = displayName.length > 22 ? displayName.substring(0, 22) + '...' : displayName;
                  
                  return (
                    <div 
                      key={pane.id} 
                      className="flex items-center"
                      style={{ width: '272px', gap: '8px' }}
                    >
                      {/* Pane Label */}
                      <span className="text-gray-600 text-xs" style={{ width: '20px', flexShrink: 0 }}>
                        P{index + 1}
                      </span>
                      
                      {/* Custom Select Container - Fixed width */}
                      <div className="relative" style={{ width: '220px', flexShrink: 0 }}>
                        {/* Hidden native select */}
                        <select
                          value={pane.endpoint.id}
                          onChange={(e) => {
                            const endpoint = endpoints.find(ep => ep.id === e.target.value);
                            if (endpoint) updatePaneEndpoint(pane.id, endpoint);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          style={{ width: '220px', height: '28px' }}
                          title={displayName}
                        >
                          {endpoints.map(endpoint => (
                            <option key={endpoint.id} value={endpoint.id}>
                              {endpoint.name}
                            </option>
                          ))}
                        </select>
                        
                        {/* Visual display */}
                        <div 
                          className="border border-gray-300 rounded px-2 py-1 bg-white flex items-center justify-between text-xs pointer-events-none"
                          style={{ width: '220px', height: '28px' }}
                        >
                          <span className="truncate block" style={{ maxWidth: '190px' }}>
                            {truncatedName}
                          </span>
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => removeChatPane(pane.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        style={{ width: '24px', height: '24px', flexShrink: 0 }}
                        title="Remove pane"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat Sessions - Only show when exactly one pane exists and endpoint is selected */}
          {chatPanes.length === 1 && currentEndpoint && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Chat Sessions</h3>
                <button
                  onClick={createNewSession}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Create new chat session"
                >
                  <Plus className="h-3 w-3" />
                  <span>New</span>
                </button>
              </div>
              
              {/* Chat History Toggle - only for single pane */}
              {chatPanes.length === 1 && (
                <div className="mb-3 p-2 bg-gray-50 rounded-md">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={useHistory}
                        onChange={(e) => setUseHistory(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-8 h-4 rounded-full transition-colors ${useHistory ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform ${useHistory ? 'translate-x-4' : 'translate-x-0.5'} mt-0.5`}></div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-700">Send chat history</span>
                  </label>
                </div>
              )}

              {filteredSessions.length === 0 ? (
                <p className="text-sm text-gray-500">No chat sessions yet</p>
              ) : (
                <div className="space-y-2">
                  {filteredSessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                        currentSession?.id === session.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <MessageSquare className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">
                          {session.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Collapse/Expand Button - Only show when panes are open */}
      {chatPanes.length > 0 && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`fixed top-4 z-30 p-2 bg-white border border-gray-300 rounded-md shadow-lg hover:bg-gray-50 transition-all duration-300 ${
            sidebarCollapsed ? 'left-4' : 'left-[21rem]'
          }`}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-5 w-5 text-gray-600" /> : <ChevronLeft className="h-5 w-5 text-gray-600" />}
        </button>
      )}

      {/* Main Content */}
      <div 
        className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-0' : 'ml-80'
        }`}
      >
        {chatPanes.length > 0 ? (
          performanceMode && chatPanes.length >= 2 ? (
            <PerformanceView
              panes={chatPanes}
              onAddPane={addChatPane}
              onRemovePane={removeChatPane}
              onSendMessage={sendMessageToAllPanes}
              onSendMessageToPane={sendMessageToSinglePane}
              onClearChat={clearAllChats}
              demoWordCount={demoWordCount}
              demoIncludeEssays={demoIncludeEssays}
              demoIncludeSummaries={demoIncludeSummaries}
              demoIncludeImages={demoIncludeImages}
              demoIncludeCoding={demoIncludeCoding}
              demoIncludeToolCalling={demoIncludeToolCalling}
              demoQuestionDelay={demoQuestionDelay}
              demoSubmitDelay={demoSubmitDelay}
              onDemoStateChange={handleDemoStateChange}
              sidebarCollapsed={sidebarCollapsed}
              performanceMode={performanceMode}
              limitedRuns={limitedRuns}
              numberOfRuns={numberOfRuns}
            />
          ) : (
            <ChatInterface
              panes={chatPanes}
              onAddPane={addChatPane}
              onRemovePane={removeChatPane}
              onSendMessage={sendMessageToAllPanes}
              onClearChat={clearAllChats}
              demoWordCount={demoWordCount}
              demoIncludeEssays={demoIncludeEssays}
              demoIncludeSummaries={demoIncludeSummaries}
              demoIncludeImages={demoIncludeImages}
              demoIncludeCoding={demoIncludeCoding}
              demoIncludeToolCalling={demoIncludeToolCalling}
              demoQuestionDelay={demoQuestionDelay}
              demoSubmitDelay={demoSubmitDelay}
              onDemoStateChange={handleDemoStateChange}
              sidebarCollapsed={sidebarCollapsed}
              performanceMode={performanceMode}
              limitedRuns={limitedRuns}
              numberOfRuns={numberOfRuns}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                Start a new chat
              </h2>
              <p className="text-gray-500">
                Create a new chat session to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint Manager Modal */}
      {showEndpointManager && (
        <EndpointManager
          endpoints={endpoints}
          platforms={platforms}
          apiKeys={apiKeys}
          onEndpointChange={loadInitialData}
          onClose={() => setShowEndpointManager(false)}
        />
      )}

      {/* API Key Manager Modal */}
      {showApiKeyManager && (
        <ApiKeyManager
          apiKeys={apiKeys}
          onApiKeyChange={loadInitialData}
          onClose={() => setShowApiKeyManager(false)}
        />
      )}

      {/* Demo Configuration Modal */}
      {showDemoConfig && (
        <DemoConfig
          isOpen={showDemoConfig}
          onClose={() => setShowDemoConfig(false)}
          wordCount={demoWordCount}
          onWordCountChange={setDemoWordCount}
          includeEssays={demoIncludeEssays}
          onIncludeEssaysChange={setDemoIncludeEssays}
          includeSummaries={demoIncludeSummaries}
          onIncludeSummariesChange={setDemoIncludeSummaries}
          includeImages={demoIncludeImages}
          onIncludeImagesChange={setDemoIncludeImages}
          includeCoding={demoIncludeCoding}
          onIncludeCodingChange={setDemoIncludeCoding}
          includeToolCalling={demoIncludeToolCalling}
          onIncludeToolCallingChange={setDemoIncludeToolCalling}
          questionDelay={demoQuestionDelay}
          onQuestionDelayChange={setDemoQuestionDelay}
          submitDelay={demoSubmitDelay}
          onSubmitDelayChange={setDemoSubmitDelay}
          performanceMode={performanceMode}
          onPerformanceModeChange={setPerformanceMode}
          limitedRuns={limitedRuns}
          onLimitedRunsChange={setLimitedRuns}
          numberOfRuns={numberOfRuns}
          onNumberOfRunsChange={setNumberOfRuns}
        />
      )}
    </div>
  );
}

export default App;