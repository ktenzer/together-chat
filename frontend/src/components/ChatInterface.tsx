import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Plus, Trash2 } from 'lucide-react';
import ChatPane from './ChatPane';
import { uploadAPI } from '../services/api';
import { ChatInterfaceProps } from '../types';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  panes, 
  onAddPane, 
  onRemovePane, 
  onSendMessage,
  onClearChat
}) => {
  const [message, setMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate aggregate metrics per model
  const calculateAggregateMetrics = () => {
    const modelMetrics: Record<string, { 
      model: string; 
      ttftValues: number[]; 
      e2eValues: number[]; 
      avgTTFT: number; 
      avgE2E: number; 
    }> = {};

    panes.forEach(pane => {
      const modelKey = `${pane.endpoint.name}`;
      
      if (!modelMetrics[modelKey]) {
        modelMetrics[modelKey] = {
          model: pane.endpoint.name,
          ttftValues: [],
          e2eValues: [],
          avgTTFT: 0,
          avgE2E: 0
        };
      }

      // Collect all TTFT and E2E values for this model
      pane.metrics.forEach(metric => {
        if (metric.timeToFirstToken) {
          modelMetrics[modelKey].ttftValues.push(metric.timeToFirstToken);
        }
        if (metric.endToEndLatency) {
          modelMetrics[modelKey].e2eValues.push(metric.endToEndLatency);
        }
      });

      // Calculate averages
      const ttftValues = modelMetrics[modelKey].ttftValues;
      const e2eValues = modelMetrics[modelKey].e2eValues;
      
      modelMetrics[modelKey].avgTTFT = ttftValues.length > 0 
        ? ttftValues.reduce((sum, val) => sum + val, 0) / ttftValues.length 
        : 0;
      
      modelMetrics[modelKey].avgE2E = e2eValues.length > 0 
        ? e2eValues.reduce((sum, val) => sum + val, 0) / e2eValues.length 
        : 0;
    });

    return Object.values(modelMetrics).filter(m => m.ttftValues.length > 0 || m.e2eValues.length > 0);
  };

  const formatLatency = (ms: number): string => {
    if (!ms) return '--';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  // Check if we have a valid session for single pane mode
  const hasValidSession = (): boolean => {
    if (panes.length !== 1) {
      // Multi-pane mode - always allow input
      return true;
    }
    
    // Single pane mode - check if we have a valid session
    const pane = panes[0];
    return pane && pane.session && !pane.session.id.startsWith('temp-');
  };

  const isInputDisabled = (): boolean => {
    return isStreaming || panes.length === 0 || !hasValidSession();
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim() && !uploadedImage) return;
    if (panes.length === 0) return;
    if (!hasValidSession()) return;

    const userMessage = message.trim();
    const imagePath = uploadedImage;
    
    setMessage('');
    setUploadedImage(null);
    setIsStreaming(true);

    try {
    // Send to all panes in parallel
    await onSendMessage(userMessage, imagePath || undefined, panes.length >= 2 ? maxTokens : undefined);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsStreaming(false);
      // Auto-focus back to textarea after sending message
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await uploadAPI.uploadImage(formData);
      setUploadedImage(response.data.path);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  if (panes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-xl font-medium text-gray-600 mb-2">
            No chat panes available
          </h2>
          <p className="text-gray-500 mb-4">
            Add a chat pane to start comparing models
          </p>
          <button
            onClick={onAddPane}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chat Pane
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Model Comparison ({panes.length}/3)
          </h2>
          <div className="flex items-center space-x-3">
            {panes.length >= 2 && (
              <div className="flex items-center space-x-2">
                <label htmlFor="maxTokens" className="text-sm text-gray-600">
                  Max Tokens:
                </label>
                <input
                  id="maxTokens"
                  type="number"
                  min="1"
                  max="4096"
                  step="1"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            <button
              onClick={onClearChat}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Clear all chats"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>
        
        {/* Aggregate Metrics Display */}
        {(() => {
          const aggregateMetrics = calculateAggregateMetrics();
          return aggregateMetrics.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-6 text-xs">
                  {aggregateMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center space-x-3 px-3 py-1 bg-gray-50 rounded-md">
                      <span className="font-medium text-gray-700">{metric.model}</span>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-gray-600">TTFT: {formatLatency(metric.avgTTFT)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-gray-600">E2E: {formatLatency(metric.avgE2E)}</span>
                        </div>
                        <span className="text-gray-500">({metric.ttftValues.length} runs)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Chat Panes */}
      <div className="flex-1 flex">
        {panes.map((pane) => (
          <ChatPane
            key={pane.id}
            pane={pane}
            onRemove={onRemovePane}
            canRemove={panes.length > 1}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {uploadedImage && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={`http://localhost:3001${uploadedImage}`} 
                  alt="Uploaded" 
                  className="w-16 h-16 object-cover rounded"
                />
                <span className="ml-3 text-sm text-gray-600">Image attached</span>
              </div>
              <button
                onClick={() => setUploadedImage(null)}
                className="text-gray-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                panes.length === 1 && !hasValidSession() 
                  ? "Create a new chat session to start messaging"
                  : "Type your message... (will be sent to all panes)"
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={3}
              disabled={isInputDisabled()}
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Upload image"
              disabled={isInputDisabled()}
            >
              <Upload className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleSendMessage}
              disabled={(!message.trim() && !uploadedImage) || isInputDisabled()}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;