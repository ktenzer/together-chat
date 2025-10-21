import { useState, useEffect } from 'react';
import { Globe, MessageSquare, Plus, Trash2, Key, Minus } from 'lucide-react';
import EndpointManager from './components/EndpointManager';
import ChatInterface from './components/ChatInterface';
import ApiKeyManager from './components/ApiKeyManager';
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
  const [loading, setLoading] = useState<boolean>(true);

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
        metrics: []
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

  const sendMessageToAllPanes = async (message: string, imagePath?: string, maxTokens?: number): Promise<void> => {
    if (chatPanes.length === 0) return;

    // Utility function to estimate token count from text
    const estimateTokenCount = (text: string): number => {
      // Simple approximation: ~1.3 tokens per word for English text
      const words = text.trim().split(/\s+/).length;
      return Math.round(words * 1.3);
    };

    // For multi-pane mode (2+), clear previous messages but keep metrics for aggregation
    const shouldClearHistory = chatPanes.length >= 2;
    
    if (shouldClearHistory) {
      // Clear all existing messages but preserve metrics for aggregation
      setChatPanes(prevPanes => 
        prevPanes.map(pane => ({
          ...pane,
          messages: [],
          // Keep metrics for aggregation across runs
        }))
      );
    }

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
        const assistantMessage: ChatMessage = {
          id: `assistant-${pane.id}-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          isStreaming: true
        };

        // Add streaming message
        setChatPanes(prev => prev.map(p => 
          p.id === pane.id 
            ? { ...p, messages: [...p.messages, assistantMessage] }
            : p
        ));

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
          use_history: chatPanes.length === 1 ? useHistory : false, // Use history toggle for single pane
          max_tokens: maxTokens,
          save_to_db: chatPanes.length === 1 // Only save to database for single pane
        }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        let accumulatedContent = '';
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
                
                // Calculate TPS metrics
                metrics.totalTokens = estimateTokenCount(accumulatedContent);
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

              if (!firstTokenReceived) {
                metrics.firstTokenTime = Date.now();
                metrics.timeToFirstToken = metrics.firstTokenTime - (metrics.requestStartTime || 0);
                firstTokenReceived = true;
              }

              // Parse JSON and extract content
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                  accumulatedContent += parsed.choices[0].delta.content;
                  
                  // Update message content
                  setChatPanes(prev => prev.map(p => 
                    p.id === pane.id 
                      ? { 
                          ...p, 
                          messages: p.messages.map(m => 
                            m.id === assistantMessage.id 
                              ? { ...m, content: accumulatedContent }
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
              // Handle image generation progress
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
                messages: p.messages.map(m => 
                  m.id === assistantMessage.id 
                    ? { ...m, isStreaming: false }
                    : m
                ),
                metrics: [...p.metrics, metrics] // Append new metrics to existing ones
              }
            : p
        ));

      } catch (error) {
        console.error(`Error in pane ${pane.id}:`, error);
        
        // Update with error message
        setChatPanes(prev => prev.map(p => 
          p.id === pane.id 
            ? { 
                ...p, 
                messages: p.messages.map(m => 
                  m.id.startsWith(`assistant-${pane.id}`) && m.isStreaming
                    ? { ...m, content: `Error: ${error}`, isStreaming: false, isError: true }
                    : m
                )
              }
            : p
        ));
      }
    });

    await Promise.all(promises);
  };

  const clearAllChats = (): void => {
    setChatPanes(prev => prev.map(pane => ({
      ...pane,
      messages: [],
      metrics: []
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <img src="/together-logo.svg" alt="Together AI" className="h-6 w-6 mr-2" />
              Together Chat
            </h1>
            <div className="flex items-center space-x-2">
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
        <div className="flex-1 overflow-y-auto">
          {/* Chat Panes Management */}
          {chatPanes.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Active Panes</h3>
              <div className="space-y-2">
                {chatPanes.map((pane, index) => (
                  <div key={pane.id} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600 flex-shrink-0">Pane {index + 1}</span>
                    <select
                      value={pane.endpoint.id}
                      onChange={(e) => {
                        const endpoint = endpoints.find(ep => ep.id === e.target.value);
                        if (endpoint) updatePaneEndpoint(pane.id, endpoint);
                      }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded flex-1"
                    >
                      {endpoints.map(endpoint => (
                        <option key={endpoint.id} value={endpoint.id}>
                          {endpoint.name}
                        </option>
                      ))}
                    </select>
                    {chatPanes.length > 1 && (
                      <button
                        onClick={() => removeChatPane(pane.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                        title="Remove pane"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {chatPanes.length > 0 ? (
          <ChatInterface
            panes={chatPanes}
            onAddPane={addChatPane}
            onRemovePane={removeChatPane}
            onSendMessage={sendMessageToAllPanes}
            onClearChat={clearAllChats}
          />
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
    </div>
  );
}

export default App;