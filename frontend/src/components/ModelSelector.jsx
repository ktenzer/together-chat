import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { togetherAPI } from '../services/api';

const ModelSelector = ({ 
  selectedModel, 
  onModelChange, 
  platformId, 
  apiKeyId, 
  apiKeys,
  modelType = 'text'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState('');

  // Get API key for Together AI requests
  const selectedApiKey = apiKeys.find(key => key.id === apiKeyId);

  useEffect(() => {
    console.log('ModelSelector - Platform:', platformId, 'API Key ID:', apiKeyId, 'Selected API Key:', selectedApiKey);
    if (platformId === 'together' && selectedApiKey?.api_key) {
      fetchTogetherModels();
    } else {
      setAvailableModels([]);
    }
  }, [platformId, selectedApiKey?.api_key, apiKeyId]);

  useEffect(() => {
    // Check if current model is in available models list
    if (selectedModel && availableModels.length > 0) {
      const modelExists = availableModels.some(model => model.id === selectedModel);
      if (!modelExists) {
        setUseCustomModel(true);
        setCustomModel(selectedModel);
      }
    }
  }, [selectedModel, availableModels]);

  const fetchTogetherModels = async () => {
    if (!selectedApiKey?.api_key) {
      console.log('No API key available for fetching models');
      return;
    }
    
    console.log('Fetching Together models with API key:', selectedApiKey.name, 'Key length:', selectedApiKey.api_key.length);
    setLoading(true);
    try {
      const response = await togetherAPI.getModels(selectedApiKey.api_key);
      console.log('Fetched models:', response.data.length, 'models');
      setAvailableModels(response.data);
    } catch (error) {
      console.error('Error fetching Together models:', error);
      setAvailableModels([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = availableModels.filter(model => {
    const matchesSearch = model.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by model type
    if (modelType === 'image') {
      return matchesSearch && (
        model.id.toLowerCase().includes('flux') ||
        model.id.toLowerCase().includes('dall-e') ||
        model.id.toLowerCase().includes('stable-diffusion') ||
        model.type === 'image'
      );
    } else {
      return matchesSearch && model.type !== 'image';
    }
  });

  const handleModelSelect = (model) => {
    onModelChange(model.id);
    setShowDropdown(false);
    setUseCustomModel(false);
    setCustomModel('');
  };

  const handleCustomModelToggle = () => {
    setUseCustomModel(!useCustomModel);
    if (!useCustomModel) {
      setCustomModel(selectedModel || '');
      setShowDropdown(false);
    } else {
      setCustomModel('');
      onModelChange('');
    }
  };

  const handleCustomModelChange = (value) => {
    setCustomModel(value);
    onModelChange(value);
  };

  if (platformId !== 'together') {
    // For non-Together platforms, just show a simple input
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model *
        </label>
        <input
          type="text"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter model name"
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Model * {loading && <span className="text-sm text-gray-500">(Loading models...)</span>}
      </label>
      
      <div className="space-y-2">
        {/* Toggle between search and custom input */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCustomModelToggle}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              useCustomModel 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {useCustomModel ? 'Using Custom Model' : 'Use Custom Model'}
          </button>
        </div>

        {useCustomModel ? (
          /* Custom model input */
          <input
            type="text"
            value={customModel}
            onChange={(e) => handleCustomModelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter custom model name"
          />
        ) : (
          /* Model search and dropdown */
          <div className="relative">
            {!selectedApiKey ? (
              <div className="p-3 text-center text-gray-500 bg-gray-50 rounded-md border border-gray-200">
                Please select an API key first to load models
              </div>
            ) : availableModels.length === 0 && !loading ? (
              <div className="p-3 text-center text-red-500 bg-red-50 rounded-md border border-red-200">
                Unable to load models. Please check your Together AI API key is valid.
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Search ${modelType} models...`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showDropdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Selected model display */}
                {selectedModel && !useCustomModel && (
                  <div className="mt-1 text-sm text-gray-600">
                    Selected: <span className="font-medium">{selectedModel}</span>
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {loading ? (
                      <div className="p-3 text-center text-gray-500">Loading models...</div>
                    ) : filteredModels.length === 0 ? (
                      <div className="p-3 text-center text-gray-500">
                        {searchTerm ? 'No models found matching your search' : 'No models available'}
                      </div>
                    ) : (
                      filteredModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelSelect(model)}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${
                            selectedModel === model.id ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-gray-500">{model.id}</div>
                          {model.context_length && (
                            <div className="text-xs text-gray-400">
                              Context: {model.context_length.toLocaleString()} tokens
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;
