import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ChatPane as ChatPaneType, ChatMessage } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatPaneProps {
  pane: ChatPaneType;
  paneIndex: number;
  onRemove: (paneId: string) => void;
  canRemove: boolean;
}

const ChatPane: React.FC<ChatPaneProps> = ({ pane }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const scrollThrottleRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  
  // Automatically expand thinking sections for new messages with thinking content
  useEffect(() => {
    const messagesWithThinking = pane.messages.filter(m => m.thinkingContent && m.thinkingContent.length > 0);
    const thinkingIds = new Set(messagesWithThinking.map(m => m.id));
    
    // Auto-expand any thinking messages that aren't already in the set
    setExpandedThinking(prev => {
      const newSet = new Set(prev);
      let hasChanges = false;
      
      thinkingIds.forEach(id => {
        if (!newSet.has(id)) {
          newSet.add(id);
          hasChanges = true;
        }
      });
      
      return hasChanges ? newSet : prev;
    });
  }, [pane.messages]);
  
  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const scrollToBottom = (force: boolean = false): void => {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTimeRef.current;
    
    // Throttle scrolling to every 150ms unless forced (e.g., new message)
    if (!force && timeSinceLastScroll < 150) {
      // Schedule a scroll for later if not already scheduled
      if (scrollThrottleRef.current === null) {
        scrollThrottleRef.current = window.setTimeout(() => {
          scrollThrottleRef.current = null;
          scrollToBottom(false);
        }, 150 - timeSinceLastScroll);
      }
      return;
    }
    
    lastScrollTimeRef.current = now;
    
    // Scroll the pane's container
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  };

  // Auto-scroll on message updates
  useEffect(() => {
    if (pane.messages.length === 0) return;
    
    const lastMessage = pane.messages[pane.messages.length - 1];
    const isStreaming = lastMessage?.isStreaming === true;
    
    // Force scroll on new messages, throttled scroll during streaming
    scrollToBottom(!isStreaming);
    
    // Cleanup throttle timeout on unmount
    return () => {
      if (scrollThrottleRef.current !== null) {
        clearTimeout(scrollThrottleRef.current);
        scrollThrottleRef.current = null;
      }
    };
  }, [pane.messages, pane.messages[pane.messages.length - 1]?.content]);


  const renderMessage = (message: ChatMessage): JSX.Element => {
    const isUser = message.role === 'user';
    const showThinking = expandedThinking.has(message.id);
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 min-w-0`}>
        <div className={`${isUser ? 'max-w-[80%]' : 'max-w-[90%]'} px-4 py-2 rounded-lg break-words overflow-hidden ${
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
            <>
              {message.thinkingContent && (
                <div className="mb-3 border-l-2 border-blue-400 pl-3">
                  <button
                    onClick={() => toggleThinking(message.id)}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mb-2"
                  >
                    {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>🧠 Thinking Process</span>
                  </button>
                  {showThinking && (
                    <div className="text-sm bg-blue-50 p-2 rounded">
                      <MarkdownRenderer 
                        content={message.thinkingContent} 
                        className="text-gray-700"
                      />
                    </div>
                  )}
                </div>
              )}
            <div className="text-sm">
              <MarkdownRenderer 
                content={message.content} 
                className={message.isError ? 'text-red-800' : 'text-gray-800'}
              />
            </div>
            </>
          )}
          {message.isStreaming && (
            <div className="flex items-center mt-1">
              <div className="animate-pulse w-2 h-2 bg-current rounded-full mr-1"></div>
              <span className="text-xs opacity-70">
                {message.isThinkingModel && !message.isAnswerPhase ? 'Thinking...' : 'Typing...'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col border-r border-gray-200 last:border-r-0 min-w-0 max-w-full overflow-hidden">
      {/* Scrollable Messages Area - Full Height */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full" ref={messagesContainerRef}>
        {pane.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">Start a conversation</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 w-full min-w-0">
            {pane.messages.map(renderMessage)}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPane;
