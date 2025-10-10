import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Platforms API
export const platformsAPI = {
  getAll: () => api.get('/platforms'),
  create: (platform) => api.post('/platforms', platform),
  update: (id, platform) => api.put(`/platforms/${id}`, platform),
  delete: (id) => api.delete(`/platforms/${id}`),
};

// API Keys API
export const apiKeysAPI = {
  getAll: () => api.get('/api-keys'),
  create: (apiKey) => api.post('/api-keys', apiKey),
  update: (id, apiKey) => api.put(`/api-keys/${id}`, apiKey),
  delete: (id) => api.delete(`/api-keys/${id}`),
};

// Endpoints API
export const endpointsAPI = {
  getAll: () => api.get('/endpoints'),
  create: (endpoint) => api.post('/endpoints', endpoint),
  update: (id, endpoint) => api.put(`/endpoints/${id}`, endpoint),
  delete: (id) => api.delete(`/endpoints/${id}`),
};

// Sessions API
export const sessionsAPI = {
  getAll: () => api.get('/sessions'),
  create: (session) => api.post('/sessions', session),
  delete: (id) => api.delete(`/sessions/${id}`),
  getMessages: (sessionId) => api.get(`/sessions/${sessionId}/messages`),
};

// Chat API
export const chatAPI = {
  sendMessage: async (data) => {
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
  uploadImage: (formData) => api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

// Together AI API
export const togetherAPI = {
  getModels: (apiKey) => api.get('/together/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  }),
};
