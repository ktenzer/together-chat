import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Upload, Plus, Trash2, Play, Square, X } from 'lucide-react';
import ChatPane from './ChatPane';
import { uploadAPI } from '../services/api';
import { ChatInterfaceProps } from '../types';
import { getRandomDemoImage, getDemoImageUrl } from '../data/demoImages';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  panes, 
  onAddPane, 
  onRemovePane, 
  onSendMessage,
  onClearChat,
  demoWordCount,
  demoIncludeImages,
  demoIncludeCoding,
  demoQuestionDelay,
  demoSubmitDelay,
  onDemoStateChange
}) => {
  const formatLatency = (ms?: number): string => {
    if (!ms) return '--';
    return `${ms.toFixed(0)}ms`;
  };
  const [message, setMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(true); // Always true as per user request
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAutoDemo, setIsAutoDemo] = useState<boolean>(false);
  const [demoTimeoutId, setDemoTimeoutId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const isAutoDemoRef = useRef<boolean>(false);
  const scheduleIntervalRef = useRef<number | null>(null);
  // Removed unified autoscroll - individual panes handle their own scrolling

  // Demo questions organized by category for alternating pattern
  const getDemoQuestions = (wordCount: number) => {
    const essayQuestions = [
      `Write a ${wordCount} word essay on the evolution of artificial intelligence and its impact on modern society.`,
      `Write a ${wordCount} word essay on climate change and its effects on global ecosystems.`,
      `Write a ${wordCount} word essay on the role of machine learning in healthcare innovation.`,
      `Write a ${wordCount} word essay on the future of renewable energy technologies.`,
      `Write a ${wordCount} word essay on the impact of social media on human communication.`,
      `Write a ${wordCount} word essay on the ethics of genetic engineering and CRISPR technology.`,
      `Write a ${wordCount} word essay on quantum computing and its potential applications.`,
      `Write a ${wordCount} word essay on the future of space exploration and colonization.`,
      `Write a ${wordCount} word essay on cybersecurity challenges in the digital age.`,
      `Write a ${wordCount} word essay on the impact of automation on the job market.`,
    ];

    const storyQuestions = [
      `Write a ${wordCount} word story about a space explorer discovering an ancient alien civilization.`,
      `Write a ${wordCount} word story about animals in a forest working together to save their habitat.`,
      `Write a ${wordCount} word story about a time traveler who accidentally changes history.`,
      `Write a ${wordCount} word story about a robot learning to understand human emotions.`,
      `Write a ${wordCount} word story about underwater explorers finding a lost city.`,
      `Write a ${wordCount} word story about a young inventor creating a device that can communicate with plants.`,
      `Write a ${wordCount} word story about a detective solving crimes in a futuristic city.`,
      `Write a ${wordCount} word story about a chef who discovers magical ingredients.`,
      `Write a ${wordCount} word story about survivors rebuilding civilization after an apocalypse.`,
      `Write a ${wordCount} word story about a musician whose songs can alter reality.`,
    ];

    const summaryQuestions = [
      `Summarize the following article about digital transformation in business in ${wordCount} words:

Digital transformation has become a critical imperative for businesses across all industries. Companies are increasingly adopting cloud computing, artificial intelligence, and data analytics to streamline operations and enhance customer experiences. The COVID-19 pandemic accelerated this trend, forcing organizations to rapidly digitize their processes to maintain business continuity.

Key drivers of digital transformation include the need for operational efficiency, improved customer engagement, and competitive advantage. Organizations are investing heavily in technologies such as machine learning algorithms for predictive analytics, robotic process automation for routine tasks, and Internet of Things (IoT) devices for real-time monitoring.

However, digital transformation presents significant challenges. Legacy systems often create integration difficulties, requiring substantial investment in infrastructure upgrades. Employee resistance to change remains a major obstacle, necessitating comprehensive training programs and change management strategies. Data security and privacy concerns have also intensified as organizations handle increasing volumes of sensitive information.

Successful digital transformation requires strong leadership commitment, clear strategic vision, and cultural change. Companies must foster innovation mindsets, encourage experimentation, and embrace failure as a learning opportunity. Cross-functional collaboration becomes essential as traditional departmental silos break down.

The benefits of successful digital transformation are substantial. Organizations report improved operational efficiency, reduced costs, enhanced customer satisfaction, and increased revenue streams. Real-time data insights enable better decision-making, while automation frees employees to focus on higher-value activities.

Looking ahead, emerging technologies like quantum computing, extended reality, and advanced AI will continue reshaping business landscapes. Organizations that embrace digital transformation today will be better positioned to adapt to future technological disruptions and maintain competitive advantage in an increasingly digital world.`,

      `Summarize the following article about sustainable business practices in ${wordCount} words:

Sustainability has evolved from a corporate social responsibility initiative to a core business strategy. Companies worldwide are recognizing that sustainable practices not only benefit the environment but also drive long-term profitability and stakeholder value. This shift represents a fundamental change in how businesses operate and measure success.

Environmental sustainability encompasses reducing carbon footprints, minimizing waste, and conserving natural resources. Companies are implementing circular economy principles, designing products for longevity and recyclability. Renewable energy adoption has accelerated, with many organizations committing to carbon neutrality by 2030 or 2050.

Social sustainability focuses on fair labor practices, community engagement, and diversity and inclusion initiatives. Businesses are investing in employee wellbeing, ensuring supply chain transparency, and supporting local communities. These efforts enhance brand reputation and attract socially conscious consumers and employees.

Economic sustainability involves creating business models that generate long-term value while considering environmental and social impacts. This includes developing innovative products and services that address sustainability challenges, creating new revenue streams from waste reduction, and building resilient supply chains.

The business case for sustainability is compelling. Sustainable practices often lead to cost savings through improved efficiency and waste reduction. Companies with strong sustainability credentials attract investment from ESG-focused funds and enjoy better access to capital. Consumer demand for sustainable products continues growing, creating market opportunities.

Challenges include initial investment costs, complex supply chain transformations, and measuring sustainability impact. Regulatory compliance requirements are increasing globally, requiring companies to adapt quickly. Balancing short-term financial pressures with long-term sustainability goals remains difficult.

Technology plays a crucial role in enabling sustainable practices. IoT sensors monitor resource consumption, AI optimizes energy usage, and blockchain ensures supply chain transparency. Digital platforms facilitate circular economy models and enable new sustainable business models.

The future of business is inherently sustainable. Companies that integrate sustainability into their core strategies will thrive, while those that resist change risk obsolescence. Stakeholder capitalism is replacing shareholder primacy, emphasizing value creation for all stakeholders including society and the environment.`,

      `Summarize the following article about remote work trends in ${wordCount} words:

The remote work revolution has fundamentally transformed the modern workplace. What began as an emergency response to the COVID-19 pandemic has evolved into a permanent shift in how and where people work. Organizations worldwide are reimagining traditional office-based models to embrace flexible, distributed workforces.

Remote work adoption has reached unprecedented levels. Studies indicate that over 40% of the workforce now works remotely at least part-time, compared to less than 5% before 2020. This dramatic shift has been enabled by advances in communication technology, cloud computing, and collaboration tools that make distributed work feasible and productive.

Benefits of remote work are well-documented. Employees report improved work-life balance, reduced commuting stress, and increased productivity. Companies benefit from access to global talent pools, reduced real estate costs, and higher employee satisfaction and retention rates. Environmental benefits include reduced carbon emissions from decreased commuting and office energy consumption.

However, remote work presents significant challenges. Maintaining company culture and team cohesion becomes more difficult when employees are geographically dispersed. Communication barriers can lead to misunderstandings and reduced collaboration. Some employees struggle with isolation, blurred work-life boundaries, and home-based distractions.

Technology infrastructure is critical for remote work success. Organizations must invest in secure, reliable communication platforms, project management tools, and cybersecurity measures. Cloud-based systems enable seamless access to company resources from anywhere, while virtual reality and augmented reality technologies are emerging to enhance remote collaboration experiences.

Management practices must evolve for remote work effectiveness. Traditional supervision methods based on physical presence become obsolete. Results-oriented management, clear communication protocols, and regular check-ins become essential. Leaders must develop new skills in virtual team management and digital communication.

The future workplace will likely be hybrid, combining remote and in-office work. Companies are redesigning physical offices as collaboration hubs rather than individual workspaces. Flexible work arrangements are becoming standard employee expectations, influencing talent acquisition and retention strategies.

Legal and regulatory considerations continue evolving. Employment laws, tax implications, and data protection requirements vary across jurisdictions, creating compliance challenges for organizations with distributed workforces. Companies must navigate complex regulatory landscapes while maintaining operational efficiency.`
    ];

    const imageQuestions = [
      'Describe the image'
    ];

    const codingQuestions = [
      'Create a Python function that implements a binary search algorithm with proper error handling and documentation.',
      'Write a JavaScript function that debounces API calls and includes unit tests.',
      'Implement a React component for a data table with sorting, filtering, and pagination features.',
      'Design a REST API endpoint in Node.js for user authentication with JWT tokens and rate limiting.',
      'Create a SQL query that joins multiple tables to generate a complex analytics report.',
      'Write a Python class that implements a LRU (Least Recently Used) cache with O(1) operations.',
      'Build a responsive CSS layout using Flexbox that works across different screen sizes.',
      'Implement a recursive algorithm in any language to solve the Tower of Hanoi problem.',
      'Create a TypeScript interface and class for a shopping cart system with proper type safety.',
      'Write a function that processes large datasets efficiently using streaming or batch processing.',
      'Implement a graph traversal algorithm (BFS or DFS) to find the shortest path between nodes.',
      'Create a microservice architecture design for a chat application with proper error handling.',
      'Write a database migration script that safely updates schema without data loss.',
      'Implement a caching strategy for a high-traffic web application using Redis.',
      'Create a unit test suite for a complex business logic function with edge cases covered.'
    ];

    return {
      essays: essayQuestions,
      stories: storyQuestions, 
      summaries: summaryQuestions,
      images: demoIncludeImages ? imageQuestions : [],
      coding: demoIncludeCoding ? codingQuestions : []
    };
  };

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
    return panes.length === 0 || !hasValidSession();
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!message.trim() && !uploadedImage) return;
    if (panes.length === 0) return;
    if (!hasValidSession()) return;

    const userMessage = message.trim();
    const imagePath = uploadedImage;
    
    setMessage('');
    setUploadedImage(null);

    try {
    // Send to all panes in parallel
    await onSendMessage(userMessage, imagePath || undefined);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
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
  interface DemoQuestion {
    text: string;
    imagePath?: string;
  }

  // Track the current question type for alternating pattern
  const questionTypeRef = useRef<'essay' | 'summary' | 'image' | 'coding'>('essay');

  const getRandomQuestion = async (): Promise<DemoQuestion> => {
    const questionCategories = getDemoQuestions(demoWordCount);
    
    // Determine next question type in alternating pattern: essay -> summary -> image -> coding -> essay...
    let currentType = questionTypeRef.current;
    let nextType: 'essay' | 'summary' | 'image' | 'coding';
    
    // Create array of available question types
    const availableTypes: ('essay' | 'summary' | 'image' | 'coding')[] = ['essay', 'summary'];
    if (demoIncludeImages && questionCategories.images.length > 0) {
      availableTypes.push('image');
    }
    if (demoIncludeCoding && questionCategories.coding.length > 0) {
      availableTypes.push('coding');
    }
    
    // Find current index and move to next type in rotation
    const currentIndex = availableTypes.indexOf(currentType);
    const nextIndex = (currentIndex + 1) % availableTypes.length;
    nextType = availableTypes[nextIndex];
    
    questionTypeRef.current = nextType;
    
    // Select random question from the chosen category
    let questionText: string;
    let imagePath: string | undefined;
    
    if (nextType === 'essay') {
      const randomIndex = Math.floor(Math.random() * questionCategories.essays.length);
      questionText = questionCategories.essays[randomIndex];
    } else if (nextType === 'summary') {
      const randomIndex = Math.floor(Math.random() * questionCategories.summaries.length);
      questionText = questionCategories.summaries[randomIndex];
    } else if (nextType === 'image') {
      // Always use the simple "Describe the image" prompt
      questionText = 'Describe the image';
      
      // Select a random demo image
      const randomImageFilename = await getRandomDemoImage();
      if (randomImageFilename) {
        imagePath = getDemoImageUrl(randomImageFilename);
      }
    } else { // nextType === 'coding'
      const randomIndex = Math.floor(Math.random() * questionCategories.coding.length);
      questionText = questionCategories.coding[randomIndex];
    }
    
    return {
      text: questionText,
      imagePath: imagePath
    };
  };

  const sendDemoQuestion = async (): Promise<void> => {
    console.log('🚀 SEND-DEMO: Function called!');
    console.log('🚀 SEND-DEMO: Panes length check:', panes.length);
    
    if (panes.length === 0) {
      console.log('🚀 SEND-DEMO: No panes, returning early');
      stopAutoDemo();
      return;
    }

    console.log('🚀 SEND-DEMO: Getting random question...');
    const demoQuestion = await getRandomQuestion();
    console.log('🚀 SEND-DEMO: Generated question:', demoQuestion);
    
    // Set the question in the input field
    console.log('🚀 SEND-DEMO: Setting message in input field...');
    setMessage(demoQuestion.text);
    
    // Set image if present - keep demo image path as is
    let demoImagePath: string | undefined;
    if (demoQuestion.imagePath) {
      console.log('🚀 SEND-DEMO: Setting demo image:', demoQuestion.imagePath);
      // Use demo image path directly (no conversion needed)
      demoImagePath = demoQuestion.imagePath;
      setUploadedImage(demoImagePath);
    } else {
      setUploadedImage(null);
    }
    
    // Scroll to bottom to show the input area with the first question
    console.log('🚀 SEND-DEMO: Scrolling to bottom to show input area with first question');
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }, 100); // Small delay to ensure DOM has updated
    
    // Wait configured seconds before sending
    console.log(`🕐 TIMEOUT: Setting ${demoSubmitDelay}-second timeout...`);
    setDemoTimeoutId(setTimeout(async () => {
      console.log(`🕐 TIMEOUT: ${demoSubmitDelay} seconds elapsed! Checking if demo still active...`);
      console.log('🕐 TIMEOUT: isAutoDemoRef.current =', isAutoDemoRef.current);

      if (!isAutoDemoRef.current) {
        console.log('🕐 TIMEOUT: Demo was stopped (ref check), returning early');
        return;
      }
      
      // Use the captured question data instead of state variables to avoid closure issues
      const questionText = demoQuestion.text.trim();
      const imagePath = demoImagePath;
      
      console.log('🕐 TIMEOUT: About to send message:', questionText);
      console.log('🕐 TIMEOUT: Image path:', imagePath);
      
      if (questionText || imagePath) {
        try {
          // Send the message
          await onSendMessage(questionText, imagePath);
          console.log('🕐 TIMEOUT: ✅ Successfully sent demo message');
          
          // Clear UI state after successful send
          console.log('🕐 TIMEOUT: Clearing UI state...');
          setMessage(''); 
          setUploadedImage(null);
          
          // Auto-focus back to textarea
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 100);

          console.log('🕐 TIMEOUT: Waiting for all LLM responses to complete...');
          scheduleNextQuestion();
        } catch (error) {
          console.error('🕐 TIMEOUT: ❌ Error sending demo message:', error);
          stopAutoDemo();
        }
      } else {
        console.log('🕐 TIMEOUT: No message or image to send, skipping.');
        scheduleNextQuestion();
      }
    }, demoSubmitDelay * 1000) as unknown as number);
  };

  const scheduleNextQuestion = () => {
    console.log('🕐 SCHEDULE: Starting scheduleNextQuestion polling...');
    
    // Clear any existing interval
    if (scheduleIntervalRef.current) {
      clearInterval(scheduleIntervalRef.current);
      scheduleIntervalRef.current = null;
    }
    
    const intervalId = setInterval(async () => {
      console.log('🕐 SCHEDULE: Checking if streaming is complete...');
      
      const currentTime = Date.now();
      const TTFT_TIMEOUT_MS = 7000; // 7 seconds
      
      // Check streaming status and TTFT timeout for each pane
      const paneStatuses = panes.map(pane => {
        if (pane.messages.length === 0) {
          return { pane, isStreaming: false, hasResponse: false, isTimedOut: false };
        }
        
        const lastMessage = pane.messages[pane.messages.length - 1];
        const isStreaming = lastMessage?.isStreaming === true;
        const hasResponse = lastMessage?.role === 'assistant';
        
        // Check if this pane has timed out waiting for TTFT
        let isTimedOut = false;
        if (isStreaming && pane.currentMetrics?.requestStartTime) {
          const waitTime = currentTime - pane.currentMetrics.requestStartTime;
          const hasReceivedFirstToken = pane.currentMetrics.firstTokenTime !== undefined;
          isTimedOut = !hasReceivedFirstToken && waitTime > TTFT_TIMEOUT_MS;
          
          if (isTimedOut) {
            console.log(`⏰ SCHEDULE: Pane ${pane.id} timed out waiting for TTFT (${waitTime}ms > ${TTFT_TIMEOUT_MS}ms)`);
          }
        }
        
        console.log(`🕐 SCHEDULE: Pane ${pane.id} - Streaming: ${isStreaming}, HasResponse: ${hasResponse}, TimedOut: ${isTimedOut}, Role: ${lastMessage?.role}`);
        return { pane, isStreaming, hasResponse, isTimedOut };
      });
      
      // Count panes that are still actively streaming (not timed out)
      const activelyStreamingPanes = paneStatuses.filter(status => status.isStreaming && !status.isTimedOut);
      const anyPaneStreaming = activelyStreamingPanes.length > 0;
      
      // For multi-pane mode (2+), messages are cleared after each question, so we only check streaming
      // For single-pane mode, we also check if all panes have started responding
      const isMultiPaneMode = panes.length >= 2;
      let allPanesHaveResponse = true; // Default to true for multi-pane mode
      
      if (!isMultiPaneMode) {
        // Only check for assistant responses in single-pane mode (excluding timed out panes)
        allPanesHaveResponse = paneStatuses.every(status => status.hasResponse || status.isTimedOut);
      }
      
      // Count completed/timed out panes for logging
      const completedPanes = paneStatuses.filter(status => !status.isStreaming || status.isTimedOut).length;
      const timedOutPanes = paneStatuses.filter(status => status.isTimedOut).length;
      
      console.log('🕐 SCHEDULE: anyPaneStreaming =', anyPaneStreaming);
      console.log('🕐 SCHEDULE: isMultiPaneMode =', isMultiPaneMode);
      console.log('🕐 SCHEDULE: allPanesHaveResponse =', allPanesHaveResponse);
      console.log('🕐 SCHEDULE: completedPanes =', completedPanes, '/', panes.length);
      console.log('🕐 SCHEDULE: timedOutPanes =', timedOutPanes);
      console.log('🕐 SCHEDULE: isAutoDemoRef.current =', isAutoDemoRef.current);
      
      // Only proceed if no panes are actively streaming AND (multi-pane mode OR all panes have started responding)
      if (!anyPaneStreaming && allPanesHaveResponse && isAutoDemoRef.current && panes.length > 0) {
        if (timedOutPanes > 0) {
          console.log(`🕐 SCHEDULE: Proceeding with ${timedOutPanes} timed-out pane(s). Showing next question immediately, then waiting ${demoQuestionDelay} seconds before sending...`);
        } else {
          console.log(`🕐 SCHEDULE: All responses complete! Showing next question immediately, then waiting ${demoQuestionDelay} seconds before sending...`);
        }
        clearInterval(intervalId);
        scheduleIntervalRef.current = null;
        
        // Immediately show the next question in the input field
        const nextQuestion = await getRandomQuestion();
        console.log('🕐 SCHEDULE: Generated next question:', nextQuestion);
        setMessage(nextQuestion.text);
        
        // Set image if present
        let nextImagePath: string | undefined;
        if (nextQuestion.imagePath) {
          console.log('🕐 SCHEDULE: Setting demo image:', nextQuestion.imagePath);
          // Use demo image path directly (no conversion needed)
          nextImagePath = nextQuestion.imagePath;
          setUploadedImage(nextImagePath || null);
        } else {
          setUploadedImage(null);
        }
        
        // Input is now sticky, no need to scroll window
        
        // Wait configured delay before sending
        setDemoTimeoutId(setTimeout(() => {
          console.log(`🕐 SCHEDULE: ${demoQuestionDelay} seconds elapsed, checking if demo still active...`);
          console.log('🕐 SCHEDULE: Final check - isAutoDemoRef.current =', isAutoDemoRef.current);
          if (isAutoDemoRef.current) {
            // Use captured question data to avoid closure issues
            const currentMessage = nextQuestion.text.trim();
            const currentImagePath = nextImagePath;
            
            if (currentMessage || currentImagePath) {
              console.log('🕐 SCHEDULE: Sending displayed question:', currentMessage);
              onSendMessage(currentMessage, currentImagePath)
                .then(() => {
                  console.log('🕐 SCHEDULE: ✅ Successfully sent scheduled message');
                  // Clear UI state after successful send
                  setMessage('');
                  setUploadedImage(null);
                  // Auto-focus back to textarea
                  setTimeout(() => {
                    textareaRef.current?.focus();
                  }, 100);
                  // Schedule the next question
                  scheduleNextQuestion();
                })
                .catch((error) => {
                  console.error('🕐 SCHEDULE: ❌ Error sending scheduled message:', error);
                  stopAutoDemo();
                });
            } else {
              console.log('🕐 SCHEDULE: No message to send, continuing cycle');
              scheduleNextQuestion();
            }
          } else {
            console.log('🕐 SCHEDULE: ❌ Demo was stopped, not sending next question');
          }
        }, demoQuestionDelay * 1000) as unknown as number);
      } else if (isAutoDemoRef.current) {
        if (anyPaneStreaming) {
          const streamingCount = activelyStreamingPanes.length;
          const totalCount = panes.length;
          console.log(`🕐 SCHEDULE: Still streaming (${streamingCount}/${totalCount} panes active), checking again in 1 second...`);
          if (timedOutPanes > 0) {
            console.log(`🕐 SCHEDULE: Note: ${timedOutPanes} pane(s) have timed out waiting for TTFT`);
          }
        } else if (!allPanesHaveResponse && !isMultiPaneMode) {
          console.log('🕐 SCHEDULE: Waiting for all panes to start responding (single-pane mode), checking again in 1 second...');
        } else {
          console.log('🕐 SCHEDULE: Conditions not met, checking again in 1 second...');
        }
        // Do nothing, interval will re-run
      } else {
        console.log('🕐 SCHEDULE: ❌ Demo was stopped during streaming check');
        clearInterval(intervalId);
        scheduleIntervalRef.current = null;
      }
    }, 1000); // Check every second
    
    // Store the interval ID for cleanup
    scheduleIntervalRef.current = intervalId;
  };

  const startAutoDemo = useCallback(() => {
    console.log('🎯 AUTO-DEMO: Button clicked! Starting demo...');
    console.log('🎯 AUTO-DEMO: Panes count:', panes.length);
    console.log('🎯 AUTO-DEMO: Panes data:', panes);

    if (panes.length === 0) {
      alert('Please add at least one chat pane to start the demo.');
      return;
    }

    setIsAutoDemo(true);
    isAutoDemoRef.current = true;
    onDemoStateChange?.(true); // Notify parent that demo started
    console.log('🎯 AUTO-DEMO: Setting isAutoDemo to true');
    console.log('🎯 AUTO-DEMO: Setting isAutoDemoRef.current = true');
    console.log('🎯 AUTO-DEMO: isAutoDemoRef.current is now:', isAutoDemoRef.current);
    console.log('🎯 AUTO-DEMO: Set both state and ref to true');
    console.log('🎯 AUTO-DEMO: After timeout - isAutoDemoRef.current is:', isAutoDemoRef.current);
    console.log('🎯 AUTO-DEMO: After timeout - isAutoDemo state is:', isAutoDemo);
    console.log('🎯 AUTO-DEMO: Calling sendDemoQuestion...');
    sendDemoQuestion();
  }, [panes, isAutoDemo, sendDemoQuestion, onDemoStateChange]);

  const stopAutoDemo = useCallback(() => {
    console.log('🛑 AUTO-DEMO: Stop button clicked! Stopping demo...');
    setIsAutoDemo(false);
    isAutoDemoRef.current = false;
    onDemoStateChange?.(false); // Notify parent that demo stopped
    
    // Clear timeout
    if (demoTimeoutId) {
      clearTimeout(demoTimeoutId);
      setDemoTimeoutId(null);
    }
    
    // Clear interval
    if (scheduleIntervalRef.current) {
      clearInterval(scheduleIntervalRef.current);
      scheduleIntervalRef.current = null;
    }
    
    setMessage(''); // Clear any partial message in the input
    setUploadedImage(null); // Clear any uploaded image
    console.log('🛑 AUTO-DEMO: Demo stopped and cleaned up.');
  }, [setIsAutoDemo, isAutoDemoRef, demoTimeoutId, onDemoStateChange]);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      console.log('🧹 CLEANUP: Component unmounting, cleaning up timers...');
      // isAutoDemoRef.current = false; // Removed to prevent premature stopping of demo
      if (demoTimeoutId) {
        clearTimeout(demoTimeoutId);
      }
      if (scheduleIntervalRef.current) {
        clearInterval(scheduleIntervalRef.current);
      }
    };
  }, [demoTimeoutId]);

  // Monitor isAutoDemo state changes for debugging
  useEffect(() => {
    console.log('📊 STATE-MONITOR: isAutoDemo state changed to:', isAutoDemo);
    console.log('📊 STATE-MONITOR: isAutoDemoRef.current is:', isAutoDemoRef.current);
  }, [isAutoDemo]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="flex-1 flex flex-col h-screen">
      {/* Unified Sticky Header - No Gaps */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        {/* Main Header Row */}
        <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Model Comparison ({panes.length}/3)
          </h2>
          <div className="flex items-center space-x-3">
              <button
                onClick={isAutoDemo ? stopAutoDemo : startAutoDemo}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isAutoDemo 
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50 bg-red-100' 
                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                }`}
                title={isAutoDemo ? "Stop auto demo" : "Start auto demo"}
                disabled={false} // Removed isStreaming check
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

        {/* Combined Aggregate Metrics and Pane Headers - Anchored Together */}
        {panes.length > 0 && (
          <div className="flex border-t border-gray-100">
            {panes.map((pane, index) => {
              const aggregateMetrics = calculateAggregateMetrics();
              const paneMetrics = aggregateMetrics.find(m => m.model === pane.endpoint.name);
              
              return (
                <div key={pane.id} className="flex-1 px-4 py-2 border-r border-gray-200 last:border-r-0 min-w-0">
                  {/* Aggregate Metrics */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700 text-sm truncate block">{pane.endpoint.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">({paneMetrics?.ttftValues.length || 0} runs)</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs mb-3 overflow-x-auto">
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">TTFT: {paneMetrics?.avgTTFT ? formatLatency(paneMetrics.avgTTFT) : '--'}</span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">E2E: {paneMetrics?.avgE2E ? formatLatency(paneMetrics.avgE2E) : '--'}</span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-gray-600">TPS: {paneMetrics?.avgTPS && paneMetrics.avgTPS > 0 ? `${paneMetrics.avgTPS.toFixed(1)}` : '--'}</span>
                    </div>
                  </div>
                  
                  {/* Pane Header */}
                  <div className="border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          Pane {index + 1}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {pane.endpoint.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {pane.endpoint.model}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemovePane(pane.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                        title="Remove pane"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pane Metrics Row */}
        {panes.length > 0 && (
          <div className="flex border-t border-gray-100">
            {panes.map((pane, index) => {
              const metrics = pane.currentMetrics; // Use currentMetrics for display
              return (
                <div key={`${pane.id}-${pane.currentMetrics?.timeToFirstToken || 0}`} className="flex-1 px-4 py-2 border-r border-gray-200 last:border-r-0">
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

      {/* Chat Panes - With calc height to account for fixed input */}
      <div className="flex-1 flex min-h-0 overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 400px)' }}>
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

      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-20">
        {uploadedImage && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src={uploadedImage.startsWith('/uploads/') ? `http://localhost:3001${uploadedImage}` : uploadedImage} 
                  alt="Uploaded" 
                  className="w-16 h-16 object-cover rounded"
                />
                <span className="ml-3 text-sm text-gray-600">
                  {uploadedImage.startsWith('/uploads/') ? 'Demo image attached' : 'Image attached'}
                </span>
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