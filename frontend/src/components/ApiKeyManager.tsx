import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save, XCircle, Key } from 'lucide-react';
import { apiKeysAPI } from '../services/api';
import { ApiKey, ApiKeyFormData } from '../types';

interface ApiKeyManagerProps {
  apiKeys: ApiKey[];
  onApiKeyChange: () => void;
  onClose: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ apiKeys, onApiKeyChange, onClose }) => {
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    api_key: '',
  });

  const resetForm = (): void => {
    setFormData({
      name: '',
      api_key: '',
    });
  };

  const handleCreate = (): void => {
    setIsCreating(true);
    resetForm();
  };

  const handleEdit = (apiKey: ApiKey): void => {
    setEditingApiKey(apiKey);
    setFormData({
      name: apiKey.name,
      api_key: '', // Don't pre-fill API key for security
    });
  };

  const handleCancel = (): void => {
    setIsCreating(false);
    setEditingApiKey(null);
    resetForm();
  };

  const handleSave = async (): Promise<void> => {
    try {
      if (isCreating) {
        await apiKeysAPI.create(formData);
      } else if (editingApiKey) {
        await apiKeysAPI.update(editingApiKey.id, formData);
      }
      onApiKeyChange();
      handleCancel();
    } catch (error) {
      console.error('Error saving API key:', error);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this API key?')) {
      try {
        await apiKeysAPI.delete(id);
        onApiKeyChange();
      } catch (error) {
        console.error('Error deleting API key:', error);
      }
    }
  };

  const handleInputChange = (field: keyof ApiKeyFormData, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Key className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Manage API Keys</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Create Button */}
          <div className="mb-6">
            <button
              onClick={handleCreate}
              disabled={isCreating || !!editingApiKey}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add API Key
            </button>
          </div>

          {/* Create/Edit Form */}
          {(isCreating || editingApiKey) && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isCreating ? 'Create New API Key' : 'Edit API Key'}
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
                    placeholder="My Together API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key *
                  </label>
                  <input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => handleInputChange('api_key', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your API key"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.api_key}
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

          {/* API Keys List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Existing API Keys</h3>
            {apiKeys.length === 0 ? (
              <p className="text-gray-500">No API keys configured yet.</p>
            ) : (
              <div className="grid gap-4">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(apiKey.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-400">
                          API Key: ****{apiKey.api_key.slice(-4)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(apiKey)}
                          disabled={isCreating || !!editingApiKey}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit API key"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(apiKey.id)}
                          disabled={isCreating || !!editingApiKey}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete API key"
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
  );
};

export default ApiKeyManager;
