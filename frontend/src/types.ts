// API Types
export interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

export interface Platform {
  id: string;
  name: string;
  base_url: string;
  is_custom: boolean;
  created_at: string;
}

export interface Endpoint {
  id: string;
  name: string;
  platform_id: string;
  custom_base_url: string;
  api_key_id: string;
  api_key: string;
  model: string;
  model_type: 'text' | 'image';
  system_prompt: string;
  temperature: number;
  created_at: string;
  platform_base_url: string;
  is_custom: boolean;
}

export interface ChatSession {
  id: string;
  endpoint_id: string;
  name: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_path?: string;
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
  isImageGeneration?: boolean;
}

export interface PerformanceMetrics {
  timeToFirstToken?: number;
  endToEndLatency?: number;
  requestStartTime?: number;
  firstTokenTime?: number;
  requestEndTime?: number;
  tokensPerSecond?: number;
  totalTokens?: number;
  generationTime?: number;
}

export interface ChatPane {
  id: string;
  endpoint: Endpoint;
  session: ChatSession;
  title: string;
  messages: ChatMessage[];
  metrics: PerformanceMetrics[];
  currentMetrics?: PerformanceMetrics; // Current run metrics for display
}

export interface TogetherModel {
  id: string;
  name: string;
  type: string;
  context_length: number;
  pricing: any;
}

// Form Data Types
export interface EndpointFormData {
  name: string;
  platform_id: string;
  custom_base_url: string;
  api_key_id: string;
  model: string;
  model_type: 'text' | 'image';
  system_prompt: string;
  temperature: number;
}

export interface ApiKeyFormData {
  name: string;
  api_key: string;
}

export interface ChatRequest {
  endpoint_id: string;
  session_id: string | null;
  message: string;
  image_path?: string;
  use_history?: boolean;
  save_to_db?: boolean;
}

// Component Props Types
export interface EndpointManagerProps {
  endpoints: Endpoint[];
  platforms: Platform[];
  apiKeys: ApiKey[];
  onEndpointChange: () => void;
}

export interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onApiKeyChange: () => void;
}

export interface ChatInterfaceProps {
  panes: ChatPane[];
  onAddPane: () => Promise<void>;
  onRemovePane: (paneId: string) => void;
  onSendMessage: (message: string, imagePath?: string) => Promise<void>;
  onClearChat: () => void;
  demoWordCount: number;
  demoIncludeImages: boolean;
  demoIncludeCoding: boolean;
  demoQuestionDelay: number;
  demoSubmitDelay: number;
  onDemoStateChange?: (isActive: boolean) => void;
  sidebarCollapsed?: boolean;
}

export interface ModelSelectorProps {
  platformId: string;
  apiKeyId: string;
  apiKeys: ApiKey[];
  modelType: 'text' | 'image';
  selectedModel: string;
  onModelChange: (model: string) => void;
}

// API Response Types
export interface UploadResponse {
  message: string;
  path: string;
  filename: string;
  originalName: string;
  size: number;
}

export interface ErrorResponse {
  error: string;
}
