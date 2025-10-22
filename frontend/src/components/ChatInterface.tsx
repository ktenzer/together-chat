import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Plus, Trash2, Play, Square } from 'lucide-react';
import ChatPane from './ChatPane';
import { uploadAPI } from '../services/api';
import { ChatInterfaceProps } from '../types';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  panes,
  onAddPane,
  onRemovePane,
  onSendMessage,
  onClearChat
}) => {
  const formatLatency = (ms?: number): string => {
    if (!ms) return '--';
    return `${ms.toFixed(0)}ms`;
  };
  const [message, setMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const [isAutoDemo, setIsAutoDemo] = useState<boolean>(false);
  const [demoTimeoutId, setDemoTimeoutId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const isAutoDemoRef = useRef<boolean>(false);

  // Demo questions for automatic cycling
  const demoQuestions = [
    // Essay questions
    "Write a 1000 word essay on the evolution of artificial intelligence and its impact on modern society.",
    "Write a 1000 word essay on climate change and its effects on global ecosystems.",
    "Write a 1000 word essay on the role of machine learning in healthcare innovation.",
    "Write a 1000 word essay on the future of renewable energy technologies.",
    "Write a 1000 word essay on the impact of social media on human communication.",
    "Write a 1000 word essay on the ethics of genetic engineering and CRISPR technology.",
    
    // Story questions
    "Write a 1000 word story about a space explorer discovering an ancient alien civilization.",
    "Write a 1000 word story about animals in a forest working together to save their habitat.",
    "Write a 1000 word story about a time traveler who accidentally changes history.",
    "Write a 1000 word story about a robot learning to understand human emotions.",
    "Write a 1000 word story about underwater explorers finding a lost city.",
    "Write a 1000 word story about a young inventor creating a device that can communicate with plants.",
    
    // Article summary questions
    `Summarize the following article about digital transformation in business:

Digital transformation has become a critical imperative for businesses across all industries. Companies are increasingly adopting cloud computing, artificial intelligence, and data analytics to streamline operations and enhance customer experiences. The COVID-19 pandemic accelerated this trend, forcing organizations to rapidly digitize their processes to maintain business continuity.

Key drivers of digital transformation include the need for operational efficiency, improved customer engagement, and competitive advantage. Organizations are investing heavily in technologies such as machine learning algorithms for predictive analytics, robotic process automation for routine tasks, and Internet of Things (IoT) devices for real-time monitoring.

However, digital transformation presents significant challenges. Legacy systems often create integration difficulties, requiring substantial investment in infrastructure upgrades. Employee resistance to change remains a major obstacle, necessitating comprehensive training programs and change management strategies. Data security and privacy concerns have also intensified as organizations handle increasing volumes of sensitive information.

Successful digital transformation requires strong leadership commitment, clear strategic vision, and cultural change. Companies must foster innovation mindsets, encourage experimentation, and embrace failure as a learning opportunity. Cross-functional collaboration becomes essential as traditional departmental silos break down.

The benefits of successful digital transformation are substantial. Organizations report improved operational efficiency, reduced costs, enhanced customer satisfaction, and increased revenue streams. Real-time data insights enable better decision-making, while automation frees employees to focus on higher-value activities.

Looking ahead, emerging technologies like quantum computing, extended reality, and advanced AI will continue reshaping business landscapes. Organizations that embrace digital transformation today will be better positioned to adapt to future technological disruptions and maintain competitive advantage in an increasingly digital world.`,

    `Summarize the following article about sustainable business practices:

Sustainability has evolved from a corporate social responsibility initiative to a core business strategy. Companies worldwide are recognizing that sustainable practices not only benefit the environment but also drive long-term profitability and stakeholder value. This shift represents a fundamental change in how businesses operate and measure success.

Environmental sustainability encompasses reducing carbon footprints, minimizing waste, and conserving natural resources. Companies are implementing circular economy principles, designing products for longevity and recyclability. Renewable energy adoption has accelerated, with many organizations committing to carbon neutrality by 2030 or 2050.

Social sustainability focuses on fair labor practices, community engagement, and diversity and inclusion initiatives. Businesses are investing in employee wellbeing, ensuring supply chain transparency, and supporting local communities. These efforts enhance brand reputation and attract socially conscious consumers and employees.

Economic sustainability involves creating business models that generate long-term value while considering environmental and social impacts. This includes developing innovative products and services that address sustainability challenges, creating new revenue streams from waste reduction, and building resilient supply chains.

The business case for sustainability is compelling. Sustainable practices often lead to cost savings through improved efficiency and waste reduction. Companies with strong sustainability credentials attract investment from ESG-focused funds and enjoy better access to capital. Consumer demand for sustainable products continues growing, creating market opportunities.

Challenges include initial investment costs, complex supply chain transformations, and measuring sustainability impact. Regulatory compliance requirements are increasing globally, requiring companies to adapt quickly. Balancing short-term financial pressures with long-term sustainability goals remains difficult.

Technology plays a crucial role in enabling sustainable practices. IoT sensors monitor resource consumption, AI optimizes energy usage, and blockchain ensures supply chain transparency. Digital platforms facilitate circular economy models and enable new sustainable business models.

The future of business is inherently sustainable. Companies that integrate sustainability into their core strategies will thrive, while those that resist change risk obsolescence. Stakeholder capitalism is replacing shareholder primacy, emphasizing value creation for all stakeholders including society and the environment.`,

    `Summarize the following article about remote work trends:

The remote work revolution has fundamentally transformed the modern workplace. What began as an emergency response to the COVID-19 pandemic has evolved into a permanent shift in how and where people work. Organizations worldwide are reimagining traditional office-based models to embrace flexible, distributed workforces.

Remote work adoption has reached unprecedented levels. Studies indicate that over 40% of the workforce now works remotely at least part-time, compared to less than 5% before 2020. This dramatic shift has been enabled by advances in communication technology, cloud computing, and collaboration tools that make distributed work feasible and productive.

Benefits of remote work are well-documented. Employees report improved work-life balance, reduced commuting stress, and increased productivity. Companies benefit from access to global talent pools, reduced real estate costs, and higher employee satisfaction and retention rates. Environmental benefits include reduced carbon emissions from decreased commuting and office energy consumption.

However, remote work presents significant challenges. Maintaining company culture and team cohesion becomes more difficult when employees are geographically dispersed. Communication barriers can lead to misunderstandings and reduced collaboration. Some employees struggle with isolation, blurred work-life boundaries, and home-based distractions.

Technology infrastructure is critical for remote work success. Organizations must invest in secure, reliable communication platforms, project management tools, and cybersecurity measures. Cloud-based systems enable seamless access to company resources from anywhere, while virtual reality and augmented reality technologies are emerging to enhance remote collaboration experiences.

Management practices must evolve for remote work effectiveness. Traditional supervision methods based on physical presence become obsolete. Results-oriented management, clear communication protocols, and regular check-ins become essential. Leaders must develop new skills in virtual team management and digital communication.

The future workplace will likely be hybrid, combining remote and in-office work. Companies are redesigning physical offices as collaboration hubs rather than individual workspaces. Flexible work arrangements are becoming standard employee expectations, influencing talent acquisition and retention strategies.

Legal and regulatory considerations continue evolving. Employment laws, tax implications, and data protection requirements vary across jurisdictions, creating compliance challenges for organizations with distributed workforces. Companies must navigate complex regulatory landscapes while maintaining operational efficiency.`
  ];

  // Calculate aggregate metrics per model
  const calculateAggregateMetrics = () => {
    const modelMetrics: Record<string, { 
      model: string; 
      ttftValues: number[]; 
      e2eValues: number[]; 
      tpsValues: number[];
      avgTTFT: number; 
      avgE2E: number; 
      avgTPS: number;
    }> = {};

    panes.forEach(pane => {
      const modelKey = `${pane.endpoint.name}`;
      
      if (!modelMetrics[modelKey]) {
        modelMetrics[modelKey] = {
          model: pane.endpoint.name,
          ttftValues: [],
          e2eValues: [],
          tpsValues: [],
          avgTTFT: 0,
          avgE2E: 0,
          avgTPS: 0
        };
      }

      // Collect all TTFT, E2E, and TPS values for this model
      pane.metrics.forEach(metric => {
        if (metric.timeToFirstToken) {
          modelMetrics[modelKey].ttftValues.push(metric.timeToFirstToken);
        }
        if (metric.endToEndLatency) {
          modelMetrics[modelKey].e2eValues.push(metric.endToEndLatency);
        }
        if (metric.tokensPerSecond) {
          modelMetrics[modelKey].tpsValues.push(metric.tokensPerSecond);
        }
      });

      // Calculate averages
      const ttftValues = modelMetrics[modelKey].ttftValues;
      const e2eValues = modelMetrics[modelKey].e2eValues;
      const tpsValues = modelMetrics[modelKey].tpsValues;
      
      modelMetrics[modelKey].avgTTFT = ttftValues.length > 0 
        ? ttftValues.reduce((sum, val) => sum + val, 0) / ttftValues.length 
        : 0;
      
      modelMetrics[modelKey].avgE2E = e2eValues.length > 0 
        ? e2eValues.reduce((sum, val) => sum + val, 0) / e2eValues.length 
        : 0;
      
      modelMetrics[modelKey].avgTPS = tpsValues.length > 0 
        ? tpsValues.reduce((sum, val) => sum + val, 0) / tpsValues.length 
        : 0;
    });

    return Object.values(modelMetrics).filter(m => m.ttftValues.length > 0 || m.e2eValues.length > 0 || m.tpsValues.length > 0);
  };

  // Check if we have a valid session for single pane mode
  const hasValidSession = (): boolean => {
    if (panes.length !== 1) {
      // Multi-pane mode - always allow input
      return true;
    }
    
    // Single pane mode - check if we have a valid session
    const pane = panes[0];
    return pane && pane.session && !pane.session.id.startsWith('temp-');
  };

  const isInputDisabled = (): boolean => {
    return isStreaming || panes.length === 0 || !hasValidSession();
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim() && !uploadedImage) return;
    if (panes.length === 0) return;
    if (!hasValidSession()) return;

    const userMessage = message.trim();
    const imagePath = uploadedImage;
    
    setMessage('');
    setUploadedImage(null);
    setIsStreaming(true);

    try {
    // Send to all panes in parallel
    await onSendMessage(userMessage, imagePath || undefined, panes.length >= 2 ? maxTokens : undefined);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsStreaming(false);
      // Auto-focus back to textarea after sending message
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-demo functions
  const getRandomQuestion = (): string => {
    const randomIndex = Math.floor(Math.random() * demoQuestions.length);
    return demoQuestions[randomIndex];
  };

  const sendDemoQuestion = async (): Promise<void> => {
    console.log('🚀 SEND-DEMO: Function called!');
    console.log('🚀 SEND-DEMO: Panes length check:', panes.length);
    
    if (panes.length === 0) {
      console.log('🚀 SEND-DEMO: No panes, returning early');
      return;
    }

    console.log('🚀 SEND-DEMO: Getting random question...');
    const question = getRandomQuestion();
    console.log('🚀 SEND-DEMO: Generated question:', question);
    
    // Set the question in the input field
    console.log('🚀 SEND-DEMO: Setting message in input field...');
    setMessage(question);
    console.log('🚀 SEND-DEMO: Message set! Current message state should be:', question);
    
    // Wait 5 seconds before sending
    console.log('🕐 TIMEOUT: Setting 5-second timeout...');
    window.setTimeout(async () => {
      console.log('🕐 TIMEOUT: 5 seconds elapsed! Checking if demo still active...');
      console.log('🕐 TIMEOUT: isAutoDemo state =', isAutoDemo);
      console.log('🕐 TIMEOUT: isAutoDemoRef.current =', isAutoDemoRef.current);
      
      if (!isAutoDemoRef.current) {
        console.log('🕐 TIMEOUT: Demo was stopped (ref check), returning early');
        return; // Check if demo was stopped
      }
      
        // For auto-demo, bypass disabled button and call send function directly
        console.log('🕐 TIMEOUT: Bypassing disabled send button, calling onSendMessage directly');
        console.log('🕐 TIMEOUT: question =', question);
        console.log('🕐 TIMEOUT: message =', message);
        console.log('🕐 TIMEOUT: panes.length =', panes.length);
        
        if (question.trim() && panes.length > 0) {
          try {
            const userMessage = question.trim();
            setMessage(''); // Clear message after sending
            await onSendMessage(userMessage, undefined, panes.length >= 2 ? maxTokens : undefined);
            console.log('🕐 TIMEOUT: ✅ Successfully sent demo message');
            
            // Auto-focus back to textarea
            setTimeout(() => {
              textareaRef.current?.focus();
            }, 100);
          } catch (error) {
            console.error('🕐 TIMEOUT: ❌ Error sending demo message:', error);
          }
        } else {
          console.log('🕐 TIMEOUT: ❌ Cannot send - no question or no panes');
          console.log('🕐 TIMEOUT: question.trim() =', question.trim());
          console.log('🕐 TIMEOUT: panes.length =', panes.length);
        }
      
      // Wait for all LLM responses to complete, then schedule next question
      if (isAutoDemoRef.current) {
        console.log('🕐 TIMEOUT: Waiting for all LLM responses to complete...');
        
        // Function to check if all responses are complete and schedule next question
        const scheduleNextQuestion = () => {
          console.log('🕐 SCHEDULE: Checking if streaming is complete...');
          console.log('🕐 SCHEDULE: isStreaming =', isStreaming);
          console.log('🕐 SCHEDULE: isAutoDemoRef.current =', isAutoDemoRef.current);
          console.log('🕐 SCHEDULE: panes.length =', panes.length);
          
          if (!isStreaming && isAutoDemoRef.current) {
            console.log('🕐 SCHEDULE: All responses complete! Waiting 10 seconds before next question...');
            const timeoutId = window.setTimeout(() => {
              console.log('🕐 SCHEDULE: 10 seconds elapsed, checking if demo still active...');
              console.log('🕐 SCHEDULE: Final check - isAutoDemoRef.current =', isAutoDemoRef.current);
              if (isAutoDemoRef.current) {
                console.log('🕐 SCHEDULE: ✅ Calling sendDemoQuestion for next cycle...');
                sendDemoQuestion();
              } else {
                console.log('🕐 SCHEDULE: ❌ Demo was stopped, not sending next question');
              }
            }, 10000);
            setDemoTimeoutId(timeoutId);
            console.log('🕐 SCHEDULE: ⏰ Set timeout ID:', timeoutId);
          } else if (isAutoDemoRef.current) {
            // Still streaming, check again in 1 second
            console.log('🕐 SCHEDULE: Still streaming, checking again in 1 second...');
            setTimeout(scheduleNextQuestion, 1000);
          } else {
            console.log('🕐 SCHEDULE: ❌ Demo was stopped during streaming check');
          }
        };
        
        // Start checking for completion
        console.log('🕐 TIMEOUT: Starting scheduleNextQuestion polling...');
        scheduleNextQuestion();
      }
    }, 5000);
  };

  const startAutoDemo = (): void => {
    console.log('🎯 AUTO-DEMO: Button clicked! Starting demo...');
    console.log('🎯 AUTO-DEMO: Panes count:', panes.length);
    console.log('🎯 AUTO-DEMO: Panes data:', panes);
    
    if (panes.length === 0) {
      console.log('🎯 AUTO-DEMO: No panes found, showing alert');
      alert('Please create a chat pane with an endpoint before starting the demo.');
      return;
    }
    
    console.log('🎯 AUTO-DEMO: Setting isAutoDemo to true');
    setIsAutoDemo(true);
    console.log('🎯 AUTO-DEMO: Setting isAutoDemoRef.current = true');
    isAutoDemoRef.current = true;
    console.log('🎯 AUTO-DEMO: isAutoDemoRef.current is now:', isAutoDemoRef.current);
    console.log('🎯 AUTO-DEMO: Set both state and ref to true');
    
    // Add a small delay to ensure state has been set
    setTimeout(() => {
      console.log('🎯 AUTO-DEMO: After timeout - isAutoDemoRef.current is:', isAutoDemoRef.current);
      console.log('🎯 AUTO-DEMO: After timeout - isAutoDemo state is:', isAutoDemo);
      console.log('🎯 AUTO-DEMO: Calling sendDemoQuestion...');
      sendDemoQuestion();
    }, 100);
  };

  const stopAutoDemo = (): void => {
    console.log('🛑 STOP-DEMO: Stopping auto demo');
    console.log('🛑 STOP-DEMO: Called from:', new Error().stack);
    console.log('🛑 STOP-DEMO: Current isAutoDemo state:', isAutoDemo);
    console.log('🛑 STOP-DEMO: Current isAutoDemoRef.current:', isAutoDemoRef.current);
    console.log('🛑 STOP-DEMO: Setting isAutoDemo state and ref to false');
    setIsAutoDemo(false);
    console.log('🛑 STOP-DEMO: Setting isAutoDemoRef.current to false');
    isAutoDemoRef.current = false;
    console.log('🛑 STOP-DEMO: isAutoDemoRef.current is now:', isAutoDemoRef.current);
    
    console.log('🛑 STOP-DEMO: Clearing timeouts...');
    if (demoTimeoutId) {
      window.clearTimeout(demoTimeoutId);
      setDemoTimeoutId(null);
      console.log('🛑 STOP-DEMO: Cleared main demo timeout');
    }
    
    setMessage(''); // Clear any pending message
    console.log('🛑 STOP-DEMO: Auto demo stopped successfully');
  };

  // Monitor isStreaming changes for debugging
  useEffect(() => {
    if (isAutoDemoRef.current) {
      console.log('📊 STREAMING-MONITOR: isStreaming changed to:', isStreaming);
    }
  }, [isStreaming]);

  // Monitor isAutoDemo state changes for debugging
  useEffect(() => {
    console.log('📊 STATE-MONITOR: isAutoDemo state changed to:', isAutoDemo);
    console.log('📊 STATE-MONITOR: isAutoDemoRef.current is:', isAutoDemoRef.current);
  }, [isAutoDemo]);

  // Cleanup timeout on unmount - but don't interfere with active demo
  useEffect(() => {
    return () => {
      if (demoTimeoutId && !isAutoDemoRef.current) {
        // Only clear timeout if demo is not active
        window.clearTimeout(demoTimeoutId);
        console.log('🧹 CLEANUP: Cleared timeout (demo was not active)');
      } else if (demoTimeoutId && isAutoDemoRef.current) {
        console.log('🧹 CLEANUP: Timeout NOT cleared (demo is active)');
      }
    };
  }, [demoTimeoutId]);

  // Cleanup on component unmount only - removed ref reset as it interferes with demo
  useEffect(() => {
    return () => {
      console.log('🧹 CLEANUP: Component unmounting (ref reset removed to prevent demo interference)');
      // Note: Removed isAutoDemoRef.current = false to prevent demo interruption
    };
  }, []); // Empty dependency array = only runs on mount/unmount

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await uploadAPI.uploadImage(formData);
      setUploadedImage(response.data.path);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  if (panes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🤖</div>
          <h2 className="text-xl font-medium text-gray-600 mb-2">
            No chat panes available
          </h2>
          <p className="text-gray-500 mb-4">
            Add a chat pane to start comparing models
          </p>
          <button
            onClick={onAddPane}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chat Pane
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Unified Sticky Header - No Gaps */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        {/* Main Header Row */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Model Comparison ({panes.length}/3)
            </h2>
            <div className="flex items-center space-x-3">
              {panes.length >= 2 && (
                <div className="flex items-center space-x-2">
                  <label htmlFor="maxTokens" className="text-sm text-gray-600">
                    Max Tokens:
                  </label>
                  <input
                    id="maxTokens"
                    type="number"
                    min="1"
                    max="4096"
                    step="1"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
              <button
                onClick={isAutoDemo ? stopAutoDemo : startAutoDemo}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isAutoDemo 
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50 bg-red-100' 
                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                }`}
                title={isAutoDemo ? "Stop auto demo" : "Start auto demo"}
                disabled={isStreaming}
              >
                {isAutoDemo ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isAutoDemo ? 'Stop' : 'Demo'}</span>
              </button>
              
              <button
                onClick={onClearChat}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Clear all chats"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Aggregate Metrics Row */}
        {panes.length > 0 && (() => {
          const aggregateMetrics = calculateAggregateMetrics();
          
          // If we have aggregate data, show it
          if (aggregateMetrics.length > 0) {
            return (
              <div className="px-4 py-2 border-t border-gray-100">
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-6 text-xs">
                    {aggregateMetrics.map((metric, index) => (
                      <div key={index} className="flex items-center space-x-3 px-3 py-1 bg-gray-50 rounded-md">
                        <span className="font-medium text-gray-700">{metric.model}</span>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600">TTFT: {formatLatency(metric.avgTTFT)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-gray-600">E2E: {formatLatency(metric.avgE2E)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-gray-600">TPS: {metric.avgTPS > 0 ? `${metric.avgTPS.toFixed(1)}` : '--'}</span>
                          </div>
                          <span className="text-gray-500">({metric.ttftValues.length} runs)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          
          // If no aggregate data yet but we have panes, show placeholder
          return (
            <div className="px-4 py-2 border-t border-gray-100">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-6 text-xs">
                  {panes.map((pane, index) => (
                    <div key={pane.id} className="flex items-center space-x-3 px-3 py-1 bg-gray-50 rounded-md">
                      <span className="font-medium text-gray-700">{pane.endpoint.model}</span>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-gray-600">TTFT: --</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-gray-600">E2E: --</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-gray-600">TPS: --</span>
                        </div>
                        <span className="text-gray-500">(0 runs)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pane Headers Row */}
        {panes.length > 0 && (
          <div className="flex border-t border-gray-100">
            {panes.map((pane, index) => (
              <div key={pane.id} className="flex-1 px-4 py-2 border-r border-gray-200 last:border-r-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      Pane {index + 1}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {pane.endpoint.name} • {pane.endpoint.model}
                    </p>
                  </div>
                  {panes.length > 1 && (
                    <button
                      onClick={() => onRemovePane(pane.id)}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove pane"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pane Metrics Row */}
        {panes.length > 0 && (
          <div className="flex border-t border-gray-100">
            {panes.map((pane, index) => {
              const metrics = pane.metrics.length > 0 ? pane.metrics[pane.metrics.length - 1] : null;
              return (
                <div key={`${pane.id}-${pane.metrics.length}-${metrics?.timeToFirstToken || 0}`} className="flex-1 px-4 py-2 border-r border-gray-200 last:border-r-0">
                  <div className="flex items-center space-x-3 text-xs text-gray-600">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      <span>TTFT: {metrics?.timeToFirstToken ? formatLatency(metrics.timeToFirstToken) : '--'}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      <span>E2E: {metrics?.endToEndLatency ? formatLatency(metrics.endToEndLatency) : '--'}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mr-1"></div>
                      <span>TPS: {metrics?.tokensPerSecond ? `${metrics.tokensPerSecond.toFixed(1)}` : '--'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat Panes - Simplified */}
      <div className="flex-1 flex">
        {panes.map((pane, index) => (
          <ChatPane
            key={pane.id}
            pane={pane}
            paneIndex={index + 1}
            onRemove={onRemovePane}
            canRemove={panes.length > 1}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {uploadedImage && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={`http://localhost:3001${uploadedImage}`} 
                  alt="Uploaded" 
                  className="w-16 h-16 object-cover rounded"
                />
                <span className="ml-3 text-sm text-gray-600">Image attached</span>
              </div>
              <button
                onClick={() => setUploadedImage(null)}
                className="text-gray-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                panes.length === 1 && !hasValidSession() 
                  ? "Create a new chat session to start messaging"
                  : "Type your message... (will be sent to all panes)"
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={3}
              disabled={isInputDisabled()}
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Upload image"
              disabled={isInputDisabled()}
            >
              <Upload className="h-5 w-5" />
            </button>
            
            <button
              ref={sendButtonRef}
              onClick={handleSendMessage}
              disabled={(!message.trim() && !uploadedImage) || isInputDisabled()}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;