import React, { useState, useEffect } from 'react';
import { Wifi, MessageSquare, Plus, Trash2, Key } from 'lucide-react';
import EndpointManager from './components/EndpointManager';
import ChatInterface from './components/ChatInterface';
import ApiKeyManager from './components/ApiKeyManager';
import { endpointsAPI, sessionsAPI, apiKeysAPI, platformsAPI } from './services/api';

function App() {
  const [endpoints, setEndpoints] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [currentEndpoint, setCurrentEndpoint] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [showEndpointManager, setShowEndpointManager] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
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

  const handleEndpointChange = (endpoint) => {
    setCurrentEndpoint(endpoint);
    setCurrentSession(null); // Reset session when endpoint changes
  };

  const handleCreateSession = async () => {
    if (!currentEndpoint) return;
    
    try {
      const sessionName = `Chat ${new Date().toLocaleString()}`;
      const response = await sessionsAPI.create({
        endpoint_id: currentEndpoint.id,
        name: sessionName,
      });
      
      const newSession = response.data;
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await sessionsAPI.delete(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
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
            <h1 className="text-xl font-bold text-gray-900">LLM Chat</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowEndpointManager(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title="Manage Endpoints"
              >
                <Wifi className="h-5 w-5" />
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
          
          {/* Endpoint Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Endpoint
            </label>
            <select
              value={currentEndpoint?.id || ''}
              onChange={(e) => {
                const endpoint = endpoints.find(ep => ep.id === e.target.value);
                handleEndpointChange(endpoint);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an endpoint</option>
              {endpoints.map(endpoint => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.name}
                </option>
              ))}
            </select>
          </div>

          {/* New Session Button */}
          <button
            onClick={handleCreateSession}
            disabled={!currentEndpoint}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Chat Sessions</h3>
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
                    onClick={() => setCurrentSession(session)}
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
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentEndpoint && currentSession ? (
          <ChatInterface
            endpoint={currentEndpoint}
            session={currentSession}
            key={currentSession.id}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                {!currentEndpoint ? 'Select an endpoint' : 'Start a new chat'}
              </h2>
              <p className="text-gray-500">
                {!currentEndpoint 
                  ? 'Choose an endpoint to begin chatting'
                  : 'Create a new chat session to get started'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Endpoint Manager Modal */}
      {showEndpointManager && (
        <EndpointManager
          endpoints={endpoints}
          onEndpointsChange={setEndpoints}
          apiKeys={apiKeys}
          onApiKeysChange={setApiKeys}
          platforms={platforms}
          onPlatformsChange={setPlatforms}
          onClose={() => setShowEndpointManager(false)}
        />
      )}

      {/* API Key Manager Modal */}
      {showApiKeyManager && (
        <ApiKeyManager
          apiKeys={apiKeys}
          onApiKeysChange={setApiKeys}
          onClose={() => setShowApiKeyManager(false)}
        />
      )}
    </div>
  );
}

export default App;
