import axios, { AxiosResponse } from 'axios';
import {
  Platform,
  ApiKey,
  Endpoint,
  ChatSession,
  ChatMessage,
  ChatRequest,
  TogetherModel,
  UploadResponse,
  ApiKeyFormData,
  EndpointFormData
} from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Platforms API
export const platformsAPI = {
  getAll: (): Promise<AxiosResponse<Platform[]>> => api.get('/platforms'),
  create: (platform: Partial<Platform>): Promise<AxiosResponse<Platform>> => api.post('/platforms', platform),
  update: (id: string, platform: Partial<Platform>): Promise<AxiosResponse<Platform>> => api.put(`/platforms/${id}`, platform),
  delete: (id: string): Promise<AxiosResponse<{ deleted: boolean }>> => api.delete(`/platforms/${id}`),
};

// API Keys API
export const apiKeysAPI = {
  getAll: (): Promise<AxiosResponse<ApiKey[]>> => api.get('/api-keys'),
  create: (apiKey: ApiKeyFormData): Promise<AxiosResponse<ApiKey>> => api.post('/api-keys', apiKey),
  update: (id: string, apiKey: ApiKeyFormData): Promise<AxiosResponse<ApiKey>> => api.put(`/api-keys/${id}`, apiKey),
  delete: (id: string): Promise<AxiosResponse<{ deleted: boolean }>> => api.delete(`/api-keys/${id}`),
};

// Endpoints API
export const endpointsAPI = {
  getAll: (): Promise<AxiosResponse<Endpoint[]>> => api.get('/endpoints'),
  create: (endpoint: EndpointFormData): Promise<AxiosResponse<Endpoint>> => api.post('/endpoints', endpoint),
  update: (id: string, endpoint: EndpointFormData): Promise<AxiosResponse<Endpoint>> => api.put(`/endpoints/${id}`, endpoint),
  delete: (id: string): Promise<AxiosResponse<{ deleted: boolean }>> => api.delete(`/endpoints/${id}`),
};

// Sessions API
export const sessionsAPI = {
  getAll: (): Promise<AxiosResponse<ChatSession[]>> => api.get('/sessions'),
  create: (session: { endpoint_id: string; name: string }): Promise<AxiosResponse<ChatSession>> => api.post('/sessions', session),
  delete: (id: string): Promise<AxiosResponse<{ deleted: boolean }>> => api.delete(`/sessions/${id}`),
  getMessages: (sessionId: string): Promise<AxiosResponse<ChatMessage[]>> => api.get(`/sessions/${sessionId}/messages`),
};

// Chat API
export const chatAPI = {
  sendMessage: async (data: ChatRequest): Promise<Response> => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response;
  },
};

// Upload API
export const uploadAPI = {
  uploadImage: (formData: FormData): Promise<AxiosResponse<UploadResponse>> => api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

// Together AI API
export const togetherAPI = {
  getModels: (apiKey: string): Promise<AxiosResponse<TogetherModel[]>> => api.get('/together/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  }),
};
