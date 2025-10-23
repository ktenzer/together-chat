import React, { useState } from 'react';
import { X } from 'lucide-react';

interface DemoConfigProps {
  isOpen: boolean;
  onClose: () => void;
  wordCount: number;
  onWordCountChange: (count: number) => void;
  includeImages: boolean;
  onIncludeImagesChange: (include: boolean) => void;
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
  includeImages,
  onIncludeImagesChange,
  questionDelay,
  onQuestionDelayChange,
  submitDelay,
  onSubmitDelayChange
}) => {
  const [localWordCount, setLocalWordCount] = useState<number>(wordCount);
  const [localIncludeImages, setLocalIncludeImages] = useState<boolean>(includeImages);
  const [localQuestionDelay, setLocalQuestionDelay] = useState<number>(questionDelay);
  const [localSubmitDelay, setLocalSubmitDelay] = useState<number>(submitDelay);

  if (!isOpen) return null;

  const handleSave = () => {
    onWordCountChange(localWordCount);
    onIncludeImagesChange(localIncludeImages);
    onQuestionDelayChange(localQuestionDelay);
    onSubmitDelayChange(localSubmitDelay);
    onClose();
  };

  const handleCancel = () => {
    setLocalWordCount(wordCount); // Reset to original values
    setLocalIncludeImages(includeImages); // Reset to original values
    setLocalQuestionDelay(questionDelay); // Reset to original values
    setLocalSubmitDelay(submitDelay); // Reset to original values
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Demo Configuration</h2>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
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
          
          {/* Image Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Include Image Description Questions
            </label>
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
              <span className="ml-3 text-sm text-gray-600">
                {localIncludeImages ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          
          {/* Question Display Delay */}
          <div>
            <label htmlFor="questionDelaySlider" className="block text-sm font-medium text-gray-700 mb-3">
              Delay Before Showing Question: <span className="font-semibold">{localQuestionDelay} seconds</span>
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
              Delay Before Submitting Question: <span className="font-semibold">{localSubmitDelay} seconds</span>
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
          
          {/* Preview Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
            <p className="text-sm text-gray-600">
              Demo will alternate between <strong>essays</strong>, <strong>article summaries</strong>, and 
              {localIncludeImages ? (
                <span> <strong>image descriptions</strong></span>
              ) : (
                <span className="text-gray-500"> image descriptions (disabled)</span>
              )}.
              <br />
              Text questions will request <strong>{localWordCount} words</strong>.
              {localIncludeImages && (
                <>
                  <br />
                  <strong>Pattern:</strong> Essay → Summary → Image → Essay → ...
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
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
