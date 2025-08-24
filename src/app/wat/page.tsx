'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Defines the possible states of the test
type TestState = 'ready' | 'running' | 'paused' | 'finished';

// Defines the structure for a single analysis item (e.g., a positive trait or area for improvement)
interface AnalysisItem {
  issue?: string;
  concern?: string;
  explanation?: string;
  evidence?: string;
  trait?: string; // for positive traits
}

// Defines the overall structure of the AI analysis report
interface Analysis {
  overall_summary?: string;
  positive_traits?: (string | AnalysisItem)[];
  areas_for_improvement?: (string | AnalysisItem)[];
  final_verdict?: string;
  olq_rating?: { [key: string]: number };
}

// Defines the structure for saving test progress to sessionStorage
interface TestProgress {
  currentWordIndex: number;
  allResponses: { word: string, response: string, timeSpent: number }[];
  timeLeft: number;
  words: string[];
}

export default function WatTestPage() {
  const [testState, setTestState] = useState<TestState>('ready');
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [currentResponse, setCurrentResponse] = useState('');
  const [allResponses, setAllResponses] = useState<{ word: string, response: string, timeSpent: number }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Memoized calculation for the progress bar percentage
  const progress = useMemo(() => {
    if (words.length === 0) return 0;
    return Math.round((currentWordIndex / words.length) * 100);
  }, [currentWordIndex, words.length]);

  // Effect to auto-save progress to sessionStorage during the test
  useEffect(() => {
    if (typeof window !== 'undefined' && testState === 'running') {
      const progressData: TestProgress = {
        currentWordIndex,
        allResponses,
        timeLeft,
        words
      };
      sessionStorage.setItem('wat-progress', JSON.stringify(progressData));
    }
  }, [currentWordIndex, allResponses, timeLeft, words, testState]);

  // Function to load saved progress from sessionStorage
  const loadSavedProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('wat-progress');
      if (saved) {
        try {
          const progressData: TestProgress = JSON.parse(saved);
          setWords(progressData.words);
          setCurrentWordIndex(progressData.currentWordIndex);
          setAllResponses(progressData.allResponses);
          setTimeLeft(progressData.timeLeft);
          return true;
        } catch (error) {
          console.error('Error loading saved progress:', error);
          sessionStorage.removeItem('wat-progress');
        }
      }
    }
    return false;
  }, []);

  // Function to clear saved progress from sessionStorage
  const clearSavedProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('wat-progress');
    }
  }, []);

  // Centralized function to start the countdown timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Function to pause the timer
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Function to resume the timer from a paused state
  const resumeTimer = useCallback(() => {
    if (testState === 'paused') {
      startTimer();
      setTestState('running');
    }
  }, [testState, startTimer]);

  // Saves the final session results to the backend with retry logic for network issues
  const saveSessionAndFinish = useCallback(async (finalResponses: { word: string, response: string, timeSpent: number }[], retryCount = 0) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/save-wat-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ responses: finalResponses }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to save session`);
      }
      
      const result = await response.json();
      setSessionId(result.data.id);
      setTestState('finished');
      clearSavedProgress();
      
    } catch (error) {
      console.error('Error saving session:', error);
      setError(error instanceof Error ? error.message : 'Failed to save session');
      
      // Simple retry logic: try up to 2 more times on failure
      if (retryCount < 2) {
        setTimeout(() => {
          saveSessionAndFinish(finalResponses, retryCount + 1);
        }, 2000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [apiUrl, isSaving, clearSavedProgress]);

  // Handles moving to the next word or finishing the test
  const handleWordComplete = useCallback(() => {
    const timeSpent = Math.max(0, 15 - timeLeft);
    const newResponse = {
      word: words[currentWordIndex],
      response: currentResponse.trim(),
      timeSpent
    };
    
    const newResponses = [...allResponses, newResponse];
    setAllResponses(newResponses);
    setCurrentResponse('');

    if (currentWordIndex === words.length - 1) {
      saveSessionAndFinish(newResponses);
    } else {
      setCurrentWordIndex(prev => prev + 1);
      setTimeLeft(15);
      startTimer();
    }
  }, [words, currentWordIndex, currentResponse, timeLeft, allResponses, saveSessionAndFinish, startTimer]);

  // Effect to automatically advance when the timer runs out
  useEffect(() => {
    if (testState === 'running' && timeLeft <= 0 && words.length > 0) {
      handleWordComplete();
    }
  }, [timeLeft, testState, words.length, handleWordComplete]);

  // Effect to auto-focus the input field when a new word appears
  useEffect(() => {
    if (testState === 'running' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWordIndex, testState]);

  // Cleanup effect to clear the timer if the component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Fetches the AI analysis for the completed session, with retry logic
  const handleAnalysis = async (retryCount = 0) => {
    if (!sessionId) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/analyze-session/${sessionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}: Failed to get analysis`);
      }
      
      const result = await response.json();
      setAnalysis(result.analysis);
      
    } catch (error) {
      console.error('Error getting analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get analysis';
      setError(errorMessage);
      
      // Simple retry logic for analysis fetch
      if (retryCount < 1) {
        setTimeout(() => {
          handleAnalysis(retryCount + 1);
        }, 3000);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Initializes a new test, checking for saved progress first
  const startTest = async () => {
    setError(null);
    setAnalysis(null);
    setSessionId(null);
    
    const hasSavedProgress = loadSavedProgress();
    if (hasSavedProgress) {
      const confirmResume = window.confirm('Found saved progress. Would you like to resume where you left off?');
      if (confirmResume) {
        setTestState('running');
        startTimer();
        return;
      } else {
        clearSavedProgress();
      }
    }
    
    // Reset state for a fresh test
    setAllResponses([]);
    setCurrentWordIndex(0);
    setCurrentResponse('');
    setTimeLeft(15);
    setIsSaving(false);
    
    try {
      const response = await fetch(`${apiUrl}/api/new-wat-test`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch test data`);
      }
      
      const data = await response.json();
      if (!Array.isArray(data.words) || data.words.length === 0) {
        throw new Error('Invalid test data received');
      }
      
      setWords(data.words);
      setTestState('running');
      startTimer();
      
    } catch (error) {
      console.error("Failed to fetch words", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Could not start the test: ${errorMessage}`);
    }
  };

  // Effect to handle global keyboard shortcuts (Pause, Resume, Submit)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (testState === 'running') {
        if (e.key === 'Escape') {
          setTestState('paused');
          pauseTimer();
        } else if (e.key === 'Enter' && e.ctrlKey && currentResponse.trim()) {
          handleWordComplete();
        }
      } else if (testState === 'paused' && e.key === 'Enter') {
        resumeTimer();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [testState, currentResponse, handleWordComplete, pauseTimer, resumeTimer]);

  // RENDER LOGIC
  // --------------------------------------------------

  // Initial screen before the test starts
  if (testState === 'ready') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-4">Word Association Test</h1>
          <p className="text-gray-400 mb-2">
            You will be shown a series of words. For each one, you have 15 seconds to write the first sentence that comes to mind.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            💡 Tips: Press <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+Enter</kbd> to submit early, <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Esc</kbd> to pause
          </p>
          
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          )}
          
          <button
            onClick={startTest}
            disabled={isSaving}
            className="px-8 py-4 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors text-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Loading...' : 'Start Test'}
          </button>
        </div>
      </main>
    );
  }

  // Screen shown when the test is paused
  if (testState === 'paused') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Test Paused</h1>
          <p className="text-gray-400 mb-8">Take a break. Your progress is saved.</p>
          
          <div className="space-x-4">
            <button
              onClick={resumeTimer}
              className="px-6 py-3 bg-green-600 font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Resume Test
            </button>
            <button
              onClick={() => {
                const confirmQuit = window.confirm('Are you sure you want to quit? Your progress will be saved.');
                if (confirmQuit) {
                  router.push('/');
                }
              }}
              className="px-6 py-3 bg-gray-600 font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Quit Test
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Screen shown after the test is completed
  if (testState === 'finished') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center w-full max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Test Complete! 🎉</h1>
          <p className="text-gray-400 mb-8">Your responses have been saved successfully.</p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => handleAnalysis()}
                className="mt-2 px-4 py-2 bg-red-600 text-sm rounded hover:bg-red-700"
              >
                Retry Analysis
              </button>
            </div>
          )}
          
          {!analysis && !isAnalyzing && !error && (
            <button
              onClick={() => handleAnalysis()}
              className="px-8 py-4 bg-green-600 font-semibold rounded-lg hover:bg-green-700 transition-colors text-xl animate-pulse mb-8"
            >
              🤖 Get AI Analysis
            </button>
          )}

          {isAnalyzing && (
            <div className="mb-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
              <p className="text-xl">AI is analyzing your responses...</p>
              <p className="text-gray-500 text-sm mt-2">This may take 30-60 seconds</p>
            </div>
          )}

          {analysis && (
            <div className="mt-8 p-8 border border-gray-700 rounded-lg bg-gray-800 text-left">
              <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">🧠 AI Feedback Report</h2>
              <div className="space-y-6">
                
                {analysis.overall_summary && (
                  <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
                    <h3 className="font-bold text-xl mb-3 text-blue-300">📋 Overall Summary</h3>
                    <p className="text-gray-300 leading-relaxed">{analysis.overall_summary}</p>
                  </div>
                )}

                {analysis.final_verdict && (
                  <div className="p-4 bg-gray-900 border border-red-500/50 rounded-lg">
                    <h3 className="font-bold text-xl mb-3 text-red-400">⚖️ Final Verdict</h3>
                    <p className="text-gray-300 italic text-lg">&quot;{analysis.final_verdict}&quot;</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analysis.positive_traits && (
                    <div className="p-4 bg-green-900/30 rounded-lg border border-green-500/30">
                      <h3 className="font-bold text-xl mb-3 text-green-300">✅ Positive Traits</h3>
                      <div className="space-y-2">
                        {analysis.positive_traits.map((trait, i) => {
                          // The API can return a mix of strings and objects, so we handle both.
                          if (typeof trait === 'object' && trait !== null) {
                            return (
                              <div key={i} className="bg-green-800/20 p-3 rounded-lg">
                                <div className="flex items-start">
                                  <span className="text-green-400 mr-2">✓</span>
                                  <div>
                                    <span className="text-gray-300 font-medium">{trait.trait || trait.issue}</span>
                                    {trait.evidence && (
                                      <div className="text-sm text-gray-400 mt-1 italic">
                                        &quot;{trait.evidence}&quot;
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            // Fallback for simple string format, which may contain basic HTML for formatting.
                            // Using dangerouslySetInnerHTML is okay here if we trust the API source.
                            return (
                              <div key={i} className="flex items-start">
                                <span className="text-green-400 mr-2">•</span>
                                <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: trait }}></span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                  
                  {analysis.areas_for_improvement && (
                    <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
                      <h3 className="font-bold text-xl mb-3 text-yellow-300">📈 Areas for Improvement</h3>
                      <div className="space-y-4">
                        {analysis.areas_for_improvement.map((area, i) => {
                          if (typeof area === 'object' && area !== null) {
                            return (
                              <div key={i} className="bg-yellow-800/20 p-4 rounded-lg border-l-4 border-yellow-400">
                                <h4 className="font-semibold text-yellow-200 mb-2">
                                  🔍 {area.issue}
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {area.explanation && (
                                    <div>
                                      <span className="font-medium text-yellow-300">Explanation: </span>
                                      <span className="text-gray-300">{area.explanation}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium text-yellow-300">Evidence: </span>
                                    <span className="text-gray-300 italic">&quot;{area.evidence}&quot;</span>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div key={i} className="flex items-start">
                                <span className="text-yellow-400 mr-2">•</span>
                                <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: area }}></span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {analysis.olq_rating && (
                  <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-500/30">
                    <h3 className="font-bold text-xl mb-4 text-purple-300">🏅 Officer Like Qualities (Rating: 1-5)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(analysis.olq_rating).map(([key, value]) => (
                        <div key={key} className="bg-gray-800 p-3 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 capitalize font-medium">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center">
                              <span className="font-bold text-blue-400 text-lg">{value}</span>
                              <span className="text-gray-500 text-sm ml-1">/ 5</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(value / 5) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-12 space-x-4">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-gray-600 font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Return to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Take Test Again
            </button>
          </div>
        </div>
      </main>
    );
  }
  
  // Loading screen shown while fetching the initial set of words
  if (words.length === 0 && testState === 'running') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <h1 className="text-3xl font-bold">Loading Test...</h1>
          <p className="text-gray-400 mt-2">Preparing your word association test</p>
        </div>
      </main>
    );
  }

  // The main test-taking interface
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-3xl">
        {/* Header with progress bar and timer */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 font-medium">
              Word {currentWordIndex + 1} of {words.length}
            </span>
            <span className="text-5xl font-bold text-red-500">
              {timeLeft}
            </span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-center text-gray-500 text-sm">
            {progress}% Complete
          </div>
        </div>

        {/* Current word display */}
        <div className="mb-8 p-8 lg:p-12 bg-gray-800 rounded-lg text-center border-2 border-gray-700 hover:border-gray-600 transition-colors">
          <h2 className="text-4xl lg:text-6xl font-bold text-blue-300 animate-pulse">
            {words[currentWordIndex]}
          </h2>
        </div>

        {/* User input area */}
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={currentResponse}
            onChange={(e) => setCurrentResponse(e.target.value)}
            placeholder="Type your response here..."
            className="w-full px-4 py-4 bg-gray-700 border-2 border-gray-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            maxLength={200}
          />
          
          <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setTestState('paused');
                  pauseTimer();
                }}
                className="hover:text-gray-300 transition-colors"
              >
                ⏸️ Pause (Esc)
              </button>
              {currentResponse.trim() && (
                <button
                  onClick={handleWordComplete}
                  className="hover:text-green-400 transition-colors"
                >
                  ⏭️ Next (Ctrl+Enter)
                </button>
              )}
            </div>
            <span>{currentResponse.length}/200</span>
          </div>

          <button
            onClick={handleWordComplete}
            disabled={!currentResponse.trim() || isSaving}
            className={`w-full px-8 py-4 font-semibold rounded-lg transition-all text-xl ${
              !currentResponse.trim() || isSaving
                ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
            }`}
          >
            {isSaving 
              ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              )
              : currentWordIndex === words.length - 1 
                ? '🎯 Finish Test' 
                : '➡️ Next Word'
            }
          </button>
        </div>

        {/* Quick tips */}
        <div className="mt-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-sm text-center">
            💡 Write the first thing that comes to mind. Don&apos;t overthink it!
          </p>
        </div>
      </div>
    </main>
  );
}