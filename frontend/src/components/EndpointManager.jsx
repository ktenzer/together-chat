import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save, XCircle, Key } from 'lucide-react';
import { endpointsAPI, apiKeysAPI } from '../services/api';
import ApiKeyManager from './ApiKeyManager';
import ModelSelector from './ModelSelector';

const EndpointManager = ({ endpoints, onEndpointsChange, apiKeys, onApiKeysChange, platforms, onPlatformsChange, onClose }) => {
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const [formData, setFormData] = useState({
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

  const resetForm = () => {
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

  const handleCreate = () => {
    setIsCreating(true);
    resetForm();
  };

  const handleEdit = (endpoint) => {
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

  const handleCancel = () => {
    setIsCreating(false);
    setEditingEndpoint(null);
    resetForm();
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        const response = await endpointsAPI.create(formData);
        onEndpointsChange(prev => [response.data, ...prev]);
      } else if (editingEndpoint) {
        const response = await endpointsAPI.update(editingEndpoint.id, formData);
        onEndpointsChange(prev => 
          prev.map(ep => ep.id === editingEndpoint.id ? response.data : ep)
        );
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving endpoint:', error);
      alert('Failed to save endpoint. Please try again.');
    }
  };

  const handleDelete = async (endpointId) => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return;
    
    try {
      await endpointsAPI.delete(endpointId);
      onEndpointsChange(prev => prev.filter(ep => ep.id !== endpointId));
    } catch (error) {
      console.error('Error deleting endpoint:', error);
      alert('Failed to delete endpoint. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'temperature' ? parseFloat(value) : value,
    }));
  };

  // Get the selected platform to check if it's custom
  const selectedPlatform = platforms.find(p => p.id === formData.platform_id);
  const isCustomPlatform = selectedPlatform?.is_custom || false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Manage Endpoints</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Add New Button */}
          <div className="mb-6">
            <button
              onClick={handleCreate}
              disabled={isCreating || editingEndpoint}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Endpoint
            </button>
          </div>

          {/* Create/Edit Form */}
          {(isCreating || editingEndpoint) && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium mb-4">
                {isCreating ? 'Create New Endpoint' : 'Edit Endpoint'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My OpenAI Endpoint"
                  />
                </div>

                <ModelSelector
                  selectedModel={formData.model}
                  onModelChange={(model) => handleInputChange('model', model)}
                  platformId={formData.platform_id}
                  apiKeyId={formData.api_key_id}
                  apiKeys={apiKeys}
                  modelType={formData.model_type}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model Type *
                  </label>
                  <select
                    value={formData.model_type}
                    onChange={(e) => handleInputChange('model_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Text Generation</option>
                    <option value="image">Image Generation</option>
                  </select>
                </div>

                <div className="md:col-span-2">
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
                        {platform.base_url && !platform.is_custom && ` (${platform.base_url})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Base URL field - only show if Custom platform is selected */}
                {isCustomPlatform && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Base URL *
                    </label>
                    <input
                      type="text"
                      value={formData.custom_base_url}
                      onChange={(e) => handleInputChange('custom_base_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://api.example.com/v1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the base URL for your custom API endpoint
                    </p>
                  </div>
                )}

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      API Key *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowApiKeyManager(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Key className="h-3 w-3 mr-1" />
                      Manage Keys
                    </button>
                  </div>
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
                  {apiKeys.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      No API keys available. Click "Manage Keys" to add one.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
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
                    rows="3"
                    value={formData.system_prompt}
                    onChange={(e) => handleInputChange('system_prompt', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="You are a helpful assistant..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-4">
                <button
                  onClick={handleCancel}
                  className="flex items-center px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.platform_id || !formData.api_key_id || !formData.model || (isCustomPlatform && !formData.custom_base_url)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Endpoints List */}
          <div className="space-y-4">
            {endpoints.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No endpoints configured yet. Add your first endpoint to get started.
              </p>
            ) : (
              endpoints.map(endpoint => (
                <div
                  key={endpoint.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        {endpoint.name}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Model:</span> {endpoint.model}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {endpoint.model_type === 'image' ? 'Image Generation' : 'Text Generation'}
                        </div>
                        <div>
                          <span className="font-medium">Temperature:</span> {endpoint.temperature}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-medium">Platform:</span> {endpoint.platform_name || 'Unknown'}
                          {endpoint.is_custom && endpoint.custom_base_url && (
                            <span className="text-gray-500"> ({endpoint.custom_base_url})</span>
                          )}
                          {!endpoint.is_custom && endpoint.platform_base_url && (
                            <span className="text-gray-500"> ({endpoint.platform_base_url})</span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">API Key:</span> {endpoint.api_key_name || 'Unknown'}
                        </div>
                        {endpoint.system_prompt && (
                          <div className="md:col-span-2">
                            <span className="font-medium">System Prompt:</span>{' '}
                            <span className="text-gray-500">
                              {endpoint.system_prompt.length > 100
                                ? `${endpoint.system_prompt.substring(0, 100)}...`
                                : endpoint.system_prompt}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(endpoint)}
                        disabled={isCreating || editingEndpoint}
                        className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                        title="Edit endpoint"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(endpoint.id)}
                        disabled={isCreating || editingEndpoint}
                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete endpoint"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* API Key Manager Modal */}
      {showApiKeyManager && (
        <ApiKeyManager
          apiKeys={apiKeys}
          onApiKeysChange={onApiKeysChange}
          onClose={() => setShowApiKeyManager(false)}
        />
      )}
    </div>
  );
};

export default EndpointManager;
