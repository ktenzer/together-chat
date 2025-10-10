import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save, XCircle, Key } from 'lucide-react';
import { apiKeysAPI } from '../services/api';

const ApiKeyManager = ({ apiKeys, onApiKeysChange, onClose }) => {
  const [editingApiKey, setEditingApiKey] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    api_key: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      api_key: '',
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    resetForm();
  };

  const handleEdit = (apiKey) => {
    setEditingApiKey(apiKey);
    setFormData({
      name: apiKey.name,
      api_key: '', // Don't pre-fill API key for security
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingApiKey(null);
    resetForm();
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        const response = await apiKeysAPI.create(formData);
        onApiKeysChange(prev => [response.data, ...prev]);
      } else if (editingApiKey) {
        const response = await apiKeysAPI.update(editingApiKey.id, formData);
        onApiKeysChange(prev => 
          prev.map(ak => ak.id === editingApiKey.id ? { ...ak, name: response.data.name } : ak)
        );
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving API key:', error);
      const message = error.response?.data?.error || 'Failed to save API key. Please try again.';
      alert(message);
    }
  };

  const handleDelete = async (apiKeyId) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    try {
      await apiKeysAPI.delete(apiKeyId);
      onApiKeysChange(prev => prev.filter(ak => ak.id !== apiKeyId));
    } catch (error) {
      console.error('Error deleting API key:', error);
      const message = error.response?.data?.error || 'Failed to delete API key. Please try again.';
      alert(message);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Key className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Manage API Keys</h2>
          </div>
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
              disabled={isCreating || editingApiKey}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New API Key
            </button>
          </div>

          {/* Create/Edit Form */}
          {(isCreating || editingApiKey) && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium mb-4">
                {isCreating ? 'Add New API Key' : 'Edit API Key'}
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
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
                  {editingApiKey && (
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to keep the existing API key
                    </p>
                  )}
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
                  disabled={!formData.name || (!formData.api_key && isCreating)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="space-y-4">
            {apiKeys.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No API keys configured yet. Add your first API key to get started.
              </p>
            ) : (
              apiKeys.map(apiKey => (
                <div
                  key={apiKey.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        {apiKey.name}
                      </h4>
                      <div className="text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(apiKey.created_at).toLocaleDateString()}
                        </div>
                        <div className="mt-1">
                          <span className="font-medium">API Key:</span>{' '}
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {'*'.repeat(20)}...
                          </code>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(apiKey)}
                        disabled={isCreating || editingApiKey}
                        className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                        title="Edit API key"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(apiKey.id)}
                        disabled={isCreating || editingApiKey}
                        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete API key"
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
    </div>
  );
};

export default ApiKeyManager;
