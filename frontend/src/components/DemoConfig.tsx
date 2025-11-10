import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DemoConfigProps {
  isOpen: boolean;
  onClose: () => void;
  wordCount: number;
  onWordCountChange: (count: number) => void;
  includeEssays: boolean;
  onIncludeEssaysChange: (include: boolean) => void;
  includeSummaries: boolean;
  onIncludeSummariesChange: (include: boolean) => void;
  includeImages: boolean;
  onIncludeImagesChange: (include: boolean) => void;
  includeCoding: boolean;
  onIncludeCodingChange: (include: boolean) => void;
  includeToolCalling: boolean;
  onIncludeToolCallingChange: (include: boolean) => void;
  questionDelay: number;
  onQuestionDelayChange: (delay: number) => void;
  submitDelay: number;
  onSubmitDelayChange: (delay: number) => void;
}

const DemoConfig: React.FC<DemoConfigProps> = ({
  isOpen,
  onClose,
  wordCount,
  onWordCountChange,
  includeEssays,
  onIncludeEssaysChange,
  includeSummaries,
  onIncludeSummariesChange,
  includeImages,
  onIncludeImagesChange,
  includeCoding,
  onIncludeCodingChange,
  includeToolCalling,
  onIncludeToolCallingChange,
  questionDelay,
  onQuestionDelayChange,
  submitDelay,
  onSubmitDelayChange
}) => {
  const [localWordCount, setLocalWordCount] = useState<number>(wordCount);
  const [localIncludeEssays, setLocalIncludeEssays] = useState<boolean>(includeEssays);
  const [localIncludeSummaries, setLocalIncludeSummaries] = useState<boolean>(includeSummaries);
  const [localIncludeImages, setLocalIncludeImages] = useState<boolean>(includeImages);
  const [localIncludeCoding, setLocalIncludeCoding] = useState<boolean>(includeCoding);
  const [localIncludeToolCalling, setLocalIncludeToolCalling] = useState<boolean>(includeToolCalling);
  const [localQuestionDelay, setLocalQuestionDelay] = useState<number>(questionDelay);
  const [localSubmitDelay, setLocalSubmitDelay] = useState<number>(submitDelay);

  if (!isOpen) return null;

  const handleSave = () => {
    onWordCountChange(localWordCount);
    onIncludeEssaysChange(localIncludeEssays);
    onIncludeSummariesChange(localIncludeSummaries);
    onIncludeImagesChange(localIncludeImages);
    onIncludeCodingChange(localIncludeCoding);
    onIncludeToolCallingChange(localIncludeToolCalling);
    onQuestionDelayChange(localQuestionDelay);
    onSubmitDelayChange(localSubmitDelay);
    onClose();
  };

  const handleCancel = () => {
    setLocalWordCount(wordCount); // Reset to original values
    setLocalIncludeEssays(includeEssays); // Reset to original values
    setLocalIncludeSummaries(includeSummaries); // Reset to original values
    setLocalIncludeImages(includeImages); // Reset to original values
    setLocalIncludeCoding(includeCoding); // Reset to original values
    setLocalIncludeToolCalling(includeToolCalling); // Reset to original values
    setLocalQuestionDelay(questionDelay); // Reset to original values
    setLocalSubmitDelay(submitDelay); // Reset to original values
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">Demo Configuration</h2>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Word Count Slider */}
              <div>
                <label htmlFor="wordCountSlider" className="block text-sm font-medium text-gray-700 mb-3">
                  Essay & Summary Word Count: <span className="font-semibold">{localWordCount} words</span>
                </label>
                <input
                  id="wordCountSlider"
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={localWordCount}
                  onChange={(e) => setLocalWordCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10</span>
                  <span>5000</span>
                </div>
              </div>

              {/* Question Categories */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Question Categories</h3>
                <div className="space-y-3">
                  {/* Essay Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700">Essays</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setLocalIncludeEssays(!localIncludeEssays)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localIncludeEssays ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            localIncludeEssays ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-600 w-16">
                        {localIncludeEssays ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700">Summaries</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setLocalIncludeSummaries(!localIncludeSummaries)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localIncludeSummaries ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            localIncludeSummaries ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-600 w-16">
                        {localIncludeSummaries ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Image Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700">Images</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setLocalIncludeImages(!localIncludeImages)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localIncludeImages ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            localIncludeImages ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-600 w-16">
                        {localIncludeImages ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Coding Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700">Coding</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setLocalIncludeCoding(!localIncludeCoding)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localIncludeCoding ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            localIncludeCoding ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-600 w-16">
                        {localIncludeCoding ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Tool Calling Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700">Tool Calling</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setLocalIncludeToolCalling(!localIncludeToolCalling)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          localIncludeToolCalling ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            localIncludeToolCalling ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-xs text-gray-600 w-16">
                        {localIncludeToolCalling ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Timing Controls */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Timing Controls</h3>
                <div className="space-y-6">
                  {/* Question Display Delay */}
                  <div>
                    <label htmlFor="questionDelaySlider" className="block text-sm font-medium text-gray-700 mb-3">
                      Delay Before Showing Question: <span className="font-semibold">{localQuestionDelay}s</span>
                    </label>
                    <input
                      id="questionDelaySlider"
                      type="range"
                      min="1"
                      max="30"
                      step="1"
                      value={localQuestionDelay}
                      onChange={(e) => setLocalQuestionDelay(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1s</span>
                      <span>30s</span>
                    </div>
                  </div>

                  {/* Submit Delay */}
                  <div>
                    <label htmlFor="submitDelaySlider" className="block text-sm font-medium text-gray-700 mb-3">
                      Delay Before Submitting: <span className="font-semibold">{localSubmitDelay}s</span>
                    </label>
                    <input
                      id="submitDelaySlider"
                      type="range"
                      min="1"
                      max="30"
                      step="1"
                      value={localSubmitDelay}
                      onChange={(e) => setLocalSubmitDelay(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1s</span>
                      <span>30s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Configuration Summary</h3>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    <strong>Active:</strong>{' '}
                    {[
                      localIncludeEssays && 'Essays',
                      localIncludeSummaries && 'Summaries',
                      localIncludeImages && 'Images',
                      localIncludeCoding && 'Coding',
                      localIncludeToolCalling && 'Tool Calling'
                    ].filter(Boolean).join(', ') || 'None'}
                  </p>
                  <p><strong>Word Count:</strong> {localWordCount} words</p>
                  <p><strong>Show Question:</strong> {localQuestionDelay}s delay</p>
                  <p><strong>Submit Question:</strong> {localSubmitDelay}s delay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoConfig;
