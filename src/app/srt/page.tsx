'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type TestState = 'ready' | 'running' | 'finished';

interface Analysis {
  overall_summary?: string;
  positive_traits?: string[];
  areas_for_improvement?: string[];
  selection_potential_analysis?: string;
  final_verdict?: string;
  olq_rating?: { [key: string]: number };
}

interface TestProgress {
  currentSituationIndex: number;
  allResponses: { situation: string, response: string, timeSpent: number }[];
  situations: string[];
}

export default function SrtTestPage() {
  const [testState, setTestState] = useState<TestState>('ready');
  const [situations, setSituations] = useState<string[]>([]);
  const [currentSituationIndex, setCurrentSituationIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState('');
  const [allResponses, setAllResponses] = useState<{ situation: string, response: string, timeSpent: number }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [wordCount, setWordCount] = useState(0);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Progress calculation
  const progress = useMemo(() => {
    if (situations.length === 0) return 0;
    return Math.round((currentSituationIndex / situations.length) * 100);
  }, [currentSituationIndex, situations.length]);

  // Word count calculation
  useEffect(() => {
    const words = currentResponse.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [currentResponse]);

  // Auto-save progress to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && testState === 'running') {
      const progressData: TestProgress = {
        currentSituationIndex,
        allResponses,
        situations
      };
      sessionStorage.setItem('srt-progress', JSON.stringify(progressData));
    }
  }, [currentSituationIndex, allResponses, situations, testState]);

  // Load saved progress
  const loadSavedProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('srt-progress');
      if (saved) {
        try {
          const progressData: TestProgress = JSON.parse(saved);
          setSituations(progressData.situations);
          setCurrentSituationIndex(progressData.currentSituationIndex);
          setAllResponses(progressData.allResponses);
          return true;
        } catch (error) {
          console.error('Error loading saved progress:', error);
          sessionStorage.removeItem('srt-progress');
        }
      }
    }
    return false;
  }, []);

  // Clear saved progress
  const clearSavedProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('srt-progress');
    }
  }, []);

  // Enhanced save function with retry logic
  const saveSessionAndFinish = useCallback(async (finalResponses: { situation: string, response: string, timeSpent: number }[], retryCount = 0) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/save-srt-session`, {
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
      
      // Retry logic
      if (retryCount < 2) {
        setTimeout(() => {
          saveSessionAndFinish(finalResponses, retryCount + 1);
        }, 2000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [apiUrl, isSaving, clearSavedProgress]);

  // Handle situation completion
  const handleNext = useCallback(() => {
    if (isSaving || !currentResponse.trim()) return;
    
    const timeSpent = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const newResponse = {
      situation: situations[currentSituationIndex],
      response: currentResponse.trim(),
      timeSpent
    };
    
    const newResponses = [...allResponses, newResponse];
    
    if (currentSituationIndex === situations.length - 1) {
      setAllResponses(newResponses);
      saveSessionAndFinish(newResponses);
    } else {
      setAllResponses(newResponses);
      setCurrentResponse('');
      setCurrentSituationIndex(prevIndex => prevIndex + 1);
      setStartTime(Date.now());
    }
  }, [allResponses, situations, currentSituationIndex, currentResponse, saveSessionAndFinish, isSaving, startTime]);

  // Focus management
  useEffect(() => {
    if (testState === 'running' && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [currentSituationIndex, testState]);

  // Set start time when starting new situation
  useEffect(() => {
    if (testState === 'running') {
      setStartTime(Date.now());
    }
  }, [currentSituationIndex, testState]);

  // Enhanced start test function
  const startTest = async () => {
    setError(null);
    setAnalysis(null);
    setSessionId(null);
    
    // Check for saved progress
    const hasSavedProgress = loadSavedProgress();
    if (hasSavedProgress) {
      const confirmResume = window.confirm('Found saved progress. Would you like to resume where you left off?');
      if (confirmResume) {
        setTestState('running');
        return;
      } else {
        clearSavedProgress();
      }
    }
    
    // Start fresh test
    setAllResponses([]);
    setCurrentSituationIndex(0);
    setCurrentResponse('');
    setIsSaving(false);
    
    try {
      const response = await fetch(`${apiUrl}/api/new-srt-test`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch test data`);
      }
      
      const data = await response.json();
      if (!Array.isArray(data.situations) || data.situations.length === 0) {
        throw new Error("Invalid test data received");
      }
      
      setSituations(data.situations);
      setTestState('running');
      
    } catch (error) {
      console.error("Failed to fetch situations:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Could not start the test: ${errorMessage}`);
    }
  };

  // Enhanced analysis function
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
      
      // Retry logic for analysis
      if (retryCount < 1) {
        setTimeout(() => {
          handleAnalysis(retryCount + 1);
        }, 3000);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (testState === 'running') {
        if (e.key === 'Enter' && e.ctrlKey && currentResponse.trim()) {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [testState, currentResponse, handleNext]);

  // Input validation
  const isResponseValid = useMemo(() => {
    return currentResponse.trim().length >= 10 && wordCount >= 3;
  }, [currentResponse, wordCount]);

  // Render functions for different states
  if (testState === 'ready') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-4">Situation Reaction Test</h1>
          <p className="text-gray-400 mb-2">
            You will be presented with a series of situations. For each one, write your reaction, describing what you would do.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            💡 Tips: Write at least 3 words, Press <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">Ctrl+Enter</kbd> to submit
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
                    <p className='text-gray-300 italic text-lg'>{`"${analysis.final_verdict}"`}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analysis.positive_traits && (
                    <div className="p-4 bg-green-900/30 rounded-lg border border-green-500/30">
                      <h3 className="font-bold text-xl mb-3 text-green-300">✅ Positive Traits</h3>
                      <ul className="space-y-2">
                        {analysis.positive_traits.map((trait, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-green-400 mr-2">•</span>
                            <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: trait }}></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {analysis.areas_for_improvement && (
                    <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
                      <h3 className="font-bold text-xl mb-3 text-yellow-300">📈 Areas for Improvement</h3>
                      <ul className="space-y-2">
                        {analysis.areas_for_improvement.map((area, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-yellow-400 mr-2">•</span>
                            <span className="text-gray-300" dangerouslySetInnerHTML={{ __html: area }}></span>
                          </li>
                        ))}
                      </ul>
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

  if (testState === 'running' && situations.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <h1 className="text-3xl font-bold">Loading Test...</h1>
          <p className="text-gray-400 mt-2">Preparing your situation reaction test</p>
        </div>
      </main>
    );
  }

  // Main test interface
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-4xl">
        {/* Header with progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-blue-400">Situation Reaction Test</h1>
            <span className="text-gray-400 font-semibold">
              Situation {currentSituationIndex + 1} of {situations.length}
            </span>
          </div>
          
          {/* Progress bar */}
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

        {/* Situation display */}
        <div className="p-6 bg-gray-800 border-2 border-gray-700 rounded-lg mb-6 hover:border-gray-600 transition-colors">
          <div className="flex items-start">
            <div className="bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center mr-4 mt-1 flex-shrink-0">
              <span className="text-white font-bold text-sm">{currentSituationIndex + 1}</span>
            </div>
            <p className="text-lg text-gray-300 leading-relaxed">
              {situations[currentSituationIndex]}
            </p>
          </div>
        </div>

        {/* Response area */}
        <div className="space-y-4">
          <div className="relative">
            <textarea
              ref={textAreaRef}
              value={currentResponse}
              onChange={(e) => setCurrentResponse(e.target.value)}
              placeholder="Describe what you would do in this situation... (minimum 3 words)"
              rows={6}
              className="w-full p-4 bg-gray-700 border-2 border-gray-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              maxLength={1000}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-500">
              {currentResponse.length}/1000
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4 text-sm">
              <span className={`transition-colors ${wordCount >= 3 ? 'text-green-400' : 'text-red-400'}`}>
                Words: {wordCount} {wordCount >= 3 ? '✓' : '(min 3)'}
              </span>
              <span className={`transition-colors ${currentResponse.trim().length >= 10 ? 'text-green-400' : 'text-yellow-400'}`}>
                Characters: {currentResponse.trim().length} {currentResponse.trim().length >= 10 ? '✓' : '(min 10)'}
              </span>
            </div>
            
            <div className="text-sm text-gray-500">
              💡 Press Ctrl+Enter to submit
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={!isResponseValid || isSaving}
            className={`w-full px-8 py-4 font-semibold rounded-lg transition-all text-xl ${
              !isResponseValid || isSaving
                ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {isSaving 
              ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              )
              : currentSituationIndex === situations.length - 1 
                ? '🎯 Finish Test' 
                : '➡️ Next Situation'
            }
          </button>
        </div>

        {/* Quick tips */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">💡 Quick Tips:</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Be specific about your actions</li>
            <li>• Consider the consequences of your decisions</li>
            <li>• Show leadership and problem-solving skills</li>
            <li>• Write naturally - this isn't a formal essay</li>
          </ul>
        </div>
      </div>
    </main>
  );
}