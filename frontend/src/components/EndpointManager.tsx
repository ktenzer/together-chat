import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save, XCircle, Key } from 'lucide-react';
import { endpointsAPI } from '../services/api';
import ApiKeyManager from './ApiKeyManager';
import ModelSelector from './ModelSelector';
import { Endpoint, Platform, ApiKey, EndpointFormData } from '../types';

interface EndpointManagerProps {
  endpoints: Endpoint[];
  platforms: Platform[];
  apiKeys: ApiKey[];
  onEndpointChange: () => void;
  onClose: () => void;
}

const EndpointManager: React.FC<EndpointManagerProps> = ({ 
  endpoints, 
  platforms, 
  apiKeys, 
  onEndpointChange, 
  onClose 
}) => {
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState<boolean>(false);
  const [formData, setFormData] = useState<EndpointFormData>({
    name: '',
    platform_id: '',
    custom_base_url: '',
    api_key_id: '',
    model: '',
    model_type: 'text',
    system_prompt: '',
    temperature: 0.7,
  });

  // Find Together AI platform as default
  const togetherPlatform = platforms.find(p => p.name === 'Together AI');
  const defaultPlatformId = togetherPlatform ? togetherPlatform.id : '';

  const resetForm = (): void => {
    setFormData({
      name: '',
      platform_id: defaultPlatformId,
      custom_base_url: '',
      api_key_id: '',
      model: '',
      model_type: 'text',
      system_prompt: '',
      temperature: 0.7,
    });
  };

  const handleCreate = (): void => {
    setIsCreating(true);
    resetForm();
  };

  const handleEdit = (endpoint: Endpoint): void => {
    setEditingEndpoint(endpoint);
    setFormData({
      name: endpoint.name,
      platform_id: endpoint.platform_id,
      custom_base_url: endpoint.custom_base_url || '',
      api_key_id: endpoint.api_key_id,
      model: endpoint.model,
      model_type: endpoint.model_type || 'text',
      system_prompt: endpoint.system_prompt || '',
      temperature: endpoint.temperature || 0.7,
    });
  };

  const handleCancel = (): void => {
    setIsCreating(false);
    setEditingEndpoint(null);
    resetForm();
  };

  const handleSave = async (): Promise<void> => {
    try {
      if (isCreating) {
        await endpointsAPI.create(formData);
      } else if (editingEndpoint) {
        await endpointsAPI.update(editingEndpoint.id, formData);
      }
      onEndpointChange();
      handleCancel();
    } catch (error) {
      console.error('Error saving endpoint:', error);
      alert('Failed to save endpoint. Please try again.');
    }
  };

  const handleDelete = async (endpointId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return;
    
    try {
      await endpointsAPI.delete(endpointId);
      onEndpointChange();
    } catch (error) {
      console.error('Error deleting endpoint:', error);
      alert('Failed to delete endpoint. Please try again.');
    }
  };

  const handleInputChange = (field: keyof EndpointFormData, value: string | number): void => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'temperature' ? parseFloat(value as string) : value,
    }));
  };

  const selectedPlatform = platforms.find(p => p.id === formData.platform_id);
  const isCustomPlatform = selectedPlatform?.is_custom;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Manage Endpoints</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Create Button & API Key Manager */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleCreate}
                disabled={isCreating || !!editingEndpoint}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Endpoint
              </button>
              <button
                onClick={() => setShowApiKeyManager(true)}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <Key className="h-4 w-4 mr-2" />
                Manage API Keys
              </button>
            </div>

            {/* Create/Edit Form */}
            {(isCreating || editingEndpoint) && (
              <div className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {isCreating ? 'Create New Endpoint' : 'Edit Endpoint'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="My Endpoint"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Platform *
                    </label>
                    <select
                      value={formData.platform_id}
                      onChange={(e) => handleInputChange('platform_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a platform</option>
                      {platforms.map(platform => (
                        <option key={platform.id} value={platform.id}>
                          {platform.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Base URL for custom platforms */}
                  {isCustomPlatform && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Base URL *
                      </label>
                      <input
                        type="url"
                        value={formData.custom_base_url}
                        onChange={(e) => handleInputChange('custom_base_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://api.example.com/v1"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key *
                    </label>
                    <select
                      value={formData.api_key_id}
                      onChange={(e) => handleInputChange('api_key_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an API key</option>
                      {apiKeys.map(apiKey => (
                        <option key={apiKey.id} value={apiKey.id}>
                          {apiKey.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model Type *
                    </label>
                    <select
                      value={formData.model_type}
                      onChange={(e) => handleInputChange('model_type', e.target.value as 'text' | 'image')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="text">Text Generation</option>
                      <option value="image">Image Generation</option>
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div className="md:col-span-2">
                    <ModelSelector
                      platformId={formData.platform_id}
                      apiKeyId={formData.api_key_id}
                      apiKeys={apiKeys}
                      modelType={formData.model_type}
                      selectedModel={formData.model}
                      onModelChange={(model) => handleInputChange('model', model)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temperature
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formData.temperature}
                      onChange={(e) => handleInputChange('temperature', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      System Prompt
                    </label>
                    <textarea
                      value={formData.system_prompt}
                      onChange={(e) => handleInputChange('system_prompt', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional system prompt..."
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={!formData.name || !formData.platform_id || !formData.api_key_id || !formData.model}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Endpoints List */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Existing Endpoints</h3>
              {endpoints.length === 0 ? (
                <p className="text-gray-500">No endpoints configured yet.</p>
              ) : (
                <div className="grid gap-4">
                  {endpoints.map((endpoint) => (
                    <div
                      key={endpoint.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{endpoint.name}</h4>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p><span className="font-medium">Platform:</span> {platforms.find(p => p.id === endpoint.platform_id)?.name}</p>
                            <p><span className="font-medium">Model:</span> {endpoint.model}</p>
                            <p><span className="font-medium">Model Type:</span> {endpoint.model_type === 'text' ? 'Text Generation' : 'Image Generation'}</p>
                            <p><span className="font-medium">Temperature:</span> {endpoint.temperature}</p>
                            {endpoint.system_prompt && (
                              <p><span className="font-medium">System Prompt:</span> {endpoint.system_prompt.substring(0, 100)}{endpoint.system_prompt.length > 100 ? '...' : ''}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEdit(endpoint)}
                            disabled={isCreating || !!editingEndpoint}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit endpoint"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(endpoint.id)}
                            disabled={isCreating || !!editingEndpoint}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete endpoint"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Key Manager Modal */}
      {showApiKeyManager && (
        <ApiKeyManager
          apiKeys={apiKeys}
          onApiKeyChange={onEndpointChange}
          onClose={() => setShowApiKeyManager(false)}
        />
      )}
    </>
  );
};

export default EndpointManager;
