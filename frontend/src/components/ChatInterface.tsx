import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, ToggleLeft, ToggleRight, Loader } from 'lucide-react';
import { sessionsAPI, chatAPI, uploadAPI } from '../services/api';
import { ChatInterfaceProps, ChatMessage } from '../types';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ endpoint, session }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useHistory, setUseHistory] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingMessageRef = useRef<string>('');

  useEffect(() => {
    loadMessages();
  }, [session.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (): Promise<void> => {
    try {
      const response = await sessionsAPI.getMessages(session.id);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (): void => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!inputMessage.trim() && !selectedImage) return;
    if (isLoading || isStreaming) return;

    setIsLoading(true);
    
    let imagePath: string | null = null;

    try {
      // Upload image if selected
      if (selectedImage) {
        const formData = new FormData();
        formData.append('image', selectedImage);
        const uploadResponse = await uploadAPI.uploadImage(formData);
        imagePath = uploadResponse.data.path;
      }

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: inputMessage,
        image_path: imagePath || undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Clear input
      const messageToSend = inputMessage;
      setInputMessage('');
      removeImage();

      // Check if this is an image generation model
      const isImageModel = endpoint.model_type === 'image';

      if (isImageModel) {
        // Handle image generation (streaming with progress)
        setIsStreaming(true);
        
        // Add streaming assistant message placeholder for progress
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Initializing...',
          timestamp: new Date().toISOString(),
          isStreaming: true,
          isImageGeneration: true,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Send message to API
        const response = await chatAPI.sendMessage({
          endpoint_id: endpoint.id,
          session_id: session.id,
          message: messageToSend,
          image_path: imagePath || undefined,
          use_history: useHistory,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('PROGRESS:')) {
                // Update progress message
                const progressText = line.substring(9);
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: progressText }
                    : msg
                ));
              } else if (line.startsWith('ERROR:')) {
                // Handle error message for image generation
                const errorText = line.substring(6);
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { 
                        ...msg, 
                        content: errorText,
                        isError: true,
                        isStreaming: false,
                        isImageGeneration: false
                      }
                    : msg
                ));
              } else if (line.startsWith('COMPLETE:')) {
                // Image generation complete
                try {
                  const result = JSON.parse(line.substring(9));
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { 
                          ...msg, 
                          content: result.content,
                          image_path: result.image_path,
                          isStreaming: false,
                          isImageGeneration: false
                        }
                      : msg
                  ));
                } catch (e) {
                  console.error('Error parsing COMPLETE response:', e);
                }
              }
            }
          }
        }
        
        setIsStreaming(false);
      } else {
        // Handle text completion (streaming)
        setIsStreaming(true);
        
        // Add streaming assistant message placeholder
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          isStreaming: true,
        };

        setMessages(prev => [...prev, assistantMessage]);
        streamingMessageRef.current = '';

        // Send message to API
        const response = await chatAPI.sendMessage({
          endpoint_id: endpoint.id,
          session_id: session.id,
          message: messageToSend,
          image_path: imagePath || undefined,
          use_history: useHistory,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            streamingMessageRef.current += chunk;

            // Check if this is an error message
            const isError = streamingMessageRef.current.startsWith('ERROR: ');
            const displayContent = isError ? streamingMessageRef.current.replace('ERROR: ', '') : streamingMessageRef.current;

            // Update the streaming message
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, content: displayContent, isError: isError }
                : msg
            ));
          }
        }

        // Mark streaming as complete
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        
        setIsStreaming(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {session.name}
            </h2>
            <p className="text-sm text-gray-500">
              Using {endpoint.name} ({endpoint.model})
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-2">Chat History</span>
              <button
                onClick={() => setUseHistory(!useHistory)}
                className="flex items-center"
              >
                {useHistory ? (
                  <ToggleRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Start a conversation with the AI assistant.</p>
            <p className="text-sm mt-2">
              {useHistory ? 'Chat history is enabled' : 'Chat history is disabled'}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.isError
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* Message Content */}
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Image Display */}
                {message.image_path && (
                  <div className="mt-2">
                    <img
                      src={`http://localhost:3001${message.image_path}`}
                      alt={message.role === 'assistant' ? "Generated image" : "Uploaded image"}
                      className={`max-w-full h-auto rounded-md border-2 transition-all duration-200 hover:scale-105 cursor-pointer ${
                        message.role === 'assistant' 
                          ? 'border-green-200 shadow-md hover:shadow-lg' 
                          : 'border-gray-200'
                      }`}
                      style={{ maxHeight: '400px' }}
                      onClick={() => window.open(`http://localhost:3001${message.image_path}`, '_blank')}
                      title={message.role === 'assistant' ? "Click to view full size" : "Uploaded image"}
                    />
                    {message.role === 'assistant' && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Click image to view full size
                      </p>
                    )}
                  </div>
                )}
                
                {/* Streaming Indicator */}
                {message.isStreaming && (
                  <div className="flex items-center mt-2">
                    {message.isImageGeneration ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        <span className="text-sm opacity-70">Generating image...</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm opacity-70">Thinking...</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Timestamp */}
                <div
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-4 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-md border border-gray-200"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="flex items-end space-x-3">
          {/* Image Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isStreaming}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload image"
          >
            <Image className="h-5 w-5" />
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={1}
              disabled={isLoading || isStreaming}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={(!inputMessage.trim() && !selectedImage) || isLoading || isStreaming}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading || isStreaming ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
