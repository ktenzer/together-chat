import React, { useState, useRef, useEffect } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { ChatPane as ChatPaneType, ChatMessage, PerformanceMetrics } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatPaneProps {
  pane: ChatPaneType;
  onRemove: (paneId: string) => void;
  canRemove: boolean;
}

const ChatPane: React.FC<ChatPaneProps> = ({ pane, onRemove, canRemove }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showMetrics, setShowMetrics] = useState<boolean>(false);

  useEffect(() => {
    // Auto-scroll to show new messages when they are added
    if (pane.messages.length > 0) {
      scrollToBottom();
    }
  }, [pane.messages]);

  const scrollToBottom = (): void => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  };

  const formatLatency = (ms?: number): string => {
    if (!ms) return '--';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatestMetrics = (): PerformanceMetrics | null => {
    return pane.metrics.length > 0 ? pane.metrics[pane.metrics.length - 1] : null;
  };

  const renderMessage = (message: ChatMessage): JSX.Element => {
    const isUser = message.role === 'user';
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`${isUser ? 'max-w-xs lg:max-w-md' : 'max-w-md lg:max-w-2xl'} px-4 py-2 rounded-lg ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : message.isError
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
        }`}>
          {message.image_path && (
            <img 
              src={`http://localhost:3001${message.image_path}`} 
              alt="Generated" 
              className="max-w-full h-auto rounded mb-2"
            />
          )}
          {isUser ? (
            // User messages: simple text without markdown
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          ) : (
            // Assistant messages: render with markdown
            <div className="text-sm">
              <MarkdownRenderer 
                content={message.content} 
                className={message.isError ? 'text-red-800' : 'text-gray-800'}
              />
            </div>
          )}
          {message.isStreaming && (
            <div className="flex items-center mt-1">
              <div className="animate-pulse w-2 h-2 bg-current rounded-full mr-1"></div>
              <span className="text-xs opacity-70">Typing...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMetricsGraph = (): JSX.Element => {
    const metrics = getLatestMetrics();
    
    return (
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>TTFT: {formatLatency(metrics?.timeToFirstToken)}</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
              <span>E2E: {formatLatency(metrics?.endToEndLatency)}</span>
            </div>
          </div>
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Toggle metrics"
          >
            <BarChart3 className="h-3 w-3" />
          </button>
        </div>
        
        {showMetrics && metrics && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2 rounded">
              <div className="font-medium">Time to First Token</div>
              <div className="text-green-600">{formatLatency(metrics.timeToFirstToken)}</div>
            </div>
            <div className="bg-white p-2 rounded">
              <div className="font-medium">End-to-End Latency</div>
              <div className="text-blue-600">{formatLatency(metrics.endToEndLatency)}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col border-r border-gray-200 last:border-r-0">
      {/* Pinned Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {pane.title}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {pane.endpoint.name} • {pane.endpoint.model}
          </p>
        </div>
        {canRemove && (
          <button
            onClick={() => onRemove(pane.id)}
            className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove pane"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Pinned Performance Metrics */}
      <div className="flex-shrink-0">
        {renderMetricsGraph()}
      </div>

      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        {pane.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">Start a conversation</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {pane.messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPane;
