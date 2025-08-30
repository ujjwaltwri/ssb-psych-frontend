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
      <main 
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        style={{ 
          background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--background) 85%, #3b82f6), var(--background) 70%), var(--background)`,
          color: 'var(--foreground)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative z-10 w-full max-w-3xl p-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block p-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl mb-8 hover:rotate-6 transition-transform duration-300 hover:scale-110 shadow-2xl shadow-blue-500/25">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 bg-clip-text text-transparent">
              Word Association Test
            </h1>
            <p className="text-xl opacity-70 max-w-2xl mx-auto leading-relaxed mb-4">
              Quick reflexes meet psychology. React to words under time pressure and discover your subconscious patterns.
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm opacity-60">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                15 seconds per word
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                60 Words
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                First instinct counts
              </span>
            </div>
          </div>
          
          {error && (
            <div 
              className="mb-8 p-6 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, #ef4444)' }}
            >
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-300 font-medium">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-3 px-4 py-2 bg-red-600/80 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div 
            className="backdrop-blur-xl p-8 rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl hover:border-black/20 dark:hover:border-white/30 transition-all duration-500 text-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
          >
            <div className="space-y-6">
              <div className="p-6 backdrop-blur-sm rounded-2xl border border-blue-500/20" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #3b82f6)' }}>
                <h3 className="text-2xl font-bold mb-4 text-blue-300">Test Instructions</h3>
                <div className="text-left space-y-3 opacity-80">
                  <p>• You will see 60 words, one at a time</p>
                  <p>• For each word, write the first sentence that comes to mind</p>
                  <p>• You have exactly 15 seconds per word</p>
                  <p>• Press Ctrl+Enter to submit early, Esc to pause</p>
                  <p>• Don't overthink - your first instinct is what matters</p>
                </div>
              </div>
              
              <button
                onClick={startTest}
                disabled={isSaving}
                className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xl font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/30 transform hover:-translate-y-1 hover:scale-105 group"
              >
                {isSaving ? (
                  <div className="flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                    Loading Test...
                  </div>
                ) : (
                  <span className="flex items-center justify-center">
                    Begin Assessment
                    <svg className="inline-block ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="text-center mt-8 opacity-50 text-sm">
            <button
              onClick={() => router.push('/')}
              className="hover:opacity-80 transition-opacity duration-300 underline decoration-blue-500/50 hover:decoration-blue-500"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Screen shown when the test is paused
  if (testState === 'paused') {
    return (
      <main 
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        style={{ 
          background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--background) 85%, #6b7280), var(--background) 70%), var(--background)`,
          color: 'var(--foreground)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-gray-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative z-10 text-center">
          <div 
            className="backdrop-blur-xl p-12 rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 85%, transparent)' }}
          >
            <div className="inline-block p-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-3xl mb-6 shadow-2xl shadow-yellow-500/25">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Test Paused
            </h1>
            <p className="text-xl opacity-70 mb-8 max-w-md mx-auto leading-relaxed">
              Take a break. Your progress is saved and you can resume anytime.
            </p>
            
            <div className="flex justify-center space-x-6">
              <button
                onClick={resumeTimer}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/30 transform hover:-translate-y-0.5 hover:scale-105"
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
                className="px-8 py-3 backdrop-blur-xl border border-black/20 dark:border-white/30 font-semibold rounded-xl hover:border-black/40 dark:hover:border-white/50 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 hover:scale-105"
                style={{ 
                  backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)',
                  color: 'var(--foreground)'
                }}
              >
                Quit Test
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Screen shown after the test is completed
  if (testState === 'finished') {
    return (
      <main 
        className="min-h-screen relative overflow-hidden p-8"
        style={{ 
          background: `radial-gradient(ellipse at top, color-mix(in srgb, var(--background) 85%, #10b981), var(--background) 70%), var(--background)`,
          color: 'var(--foreground)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-3xl mb-6 hover:rotate-12 transition-transform duration-300 shadow-2xl shadow-green-500/25">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-green-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Test Complete!
            </h1>
            <p className="text-xl opacity-70 max-w-2xl mx-auto leading-relaxed">
              Your responses have been saved successfully. Get AI-powered insights into your performance.
            </p>
          </div>
          
          {error && (
            <div 
              className="mb-8 p-6 backdrop-blur-xl rounded-2xl border border-red-500/30 shadow-xl max-w-2xl mx-auto"
              style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, #ef4444)' }}
            >
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-300 font-medium">{error}</p>
                  <button
                    onClick={() => handleAnalysis()}
                    className="mt-3 px-4 py-2 bg-red-600/80 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
                  >
                    Retry Analysis
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {!analysis && !isAnalyzing && !error && (
            <div className="text-center mb-12">
              <button
                onClick={() => handleAnalysis()}
                className="px-12 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-2xl hover:from-green-500 hover:to-blue-500 transition-all duration-300 text-xl animate-pulse hover:shadow-2xl hover:shadow-green-500/30 transform hover:-translate-y-1 hover:scale-105 group"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Get AI Analysis
                </span>
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center mb-12">
              <div 
                className="inline-block p-8 backdrop-blur-xl rounded-3xl border border-blue-500/20 shadow-2xl"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
              >
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-2xl font-semibold mb-2">AI is analyzing your responses...</p>
                <p className="opacity-60">This may take 30-60 seconds</p>
              </div>
            </div>
          )}

          {analysis && (
            <div 
              className="backdrop-blur-xl rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl p-8 mb-12"
              style={{ backgroundColor: 'color-mix(in srgb, var(--background) 85%, transparent)' }}
            >
              <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                AI Feedback Report
              </h2>
              
              <div className="space-y-8">
                {analysis.overall_summary && (
                  <div 
                    className="p-6 backdrop-blur-sm rounded-2xl border border-blue-500/20"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #3b82f6)' }}
                  >
                    <h3 className="font-bold text-2xl mb-4 text-blue-300 flex items-center">
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Overall Summary
                    </h3>
                    <p className="text-blue-100 leading-relaxed text-lg">{analysis.overall_summary}</p>
                  </div>
                )}

                {analysis.final_verdict && (
                  <div 
                    className="p-6 backdrop-blur-sm rounded-2xl border border-cyan-500/30"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #06b6d4)' }}
                  >
                    <h3 className="font-bold text-2xl mb-4 text-cyan-300 flex items-center">
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      Final Verdict
                    </h3>
                    <p className="text-cyan-100 italic text-xl font-medium">"{analysis.final_verdict}"</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {analysis.positive_traits && (
                    <div 
                      className="p-6 backdrop-blur-sm rounded-2xl border border-green-500/20"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #10b981)' }}
                    >
                      <h3 className="font-bold text-2xl mb-4 text-green-300 flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Positive Traits
                      </h3>
                      <div className="space-y-3">
                        {analysis.positive_traits.map((trait, i) => {
                          if (typeof trait === 'object' && trait !== null) {
                            return (
                              <div 
                                key={i} 
                                className="p-4 backdrop-blur-sm rounded-xl border border-green-400/20"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, #10b981)' }}
                              >
                                <div className="flex items-start">
                                  <span className="text-green-400 mr-3 mt-1">✓</span>
                                  <div>
                                    <span className="text-green-100 font-medium text-lg">{trait.trait || trait.issue}</span>
                                    {trait.evidence && (
                                      <div className="text-sm text-green-200/80 mt-2 italic">
                                        "{trait.evidence}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div key={i} className="flex items-start">
                                <span className="text-green-400 mr-3 mt-1">•</span>
                                <span className="text-green-100" dangerouslySetInnerHTML={{ __html: trait }}></span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                  
                  {analysis.areas_for_improvement && (
                    <div 
                      className="p-6 backdrop-blur-sm rounded-2xl border border-yellow-500/20"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #f59e0b)' }}
                    >
                      <h3 className="font-bold text-2xl mb-4 text-yellow-300 flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Areas for Improvement
                      </h3>
                      <div className="space-y-4">
                        {analysis.areas_for_improvement.map((area, i) => {
                          if (typeof area === 'object' && area !== null) {
                            return (
                              <div 
                                key={i} 
                                className="p-4 backdrop-blur-sm rounded-xl border border-yellow-400/20 border-l-4 border-l-yellow-400"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, #f59e0b)' }}
                              >
                                <h4 className="font-semibold text-yellow-200 mb-3 text-lg">
                                  {area.issue}
                                </h4>
                                <div className="space-y-2 text-sm">
                                  {area.explanation && (
                                    <div>
                                      <span className="font-medium text-yellow-300">Explanation: </span>
                                      <span className="text-yellow-100">{area.explanation}</span>
                                    </div>
                                  )}
                                  {area.concern && (
                                    <div>
                                      <span className="font-medium text-yellow-300">Concern: </span>
                                      <span className="text-yellow-100">{area.concern}</span>
                                    </div>
                                  )}
                                  {area.evidence && (
                                    <div>
                                      <span className="font-medium text-yellow-300">Evidence: </span>
                                      <span className="text-yellow-100 italic">"{area.evidence}"</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div key={i} className="flex items-start">
                                <span className="text-yellow-400 mr-3 mt-1">•</span>
                                <span className="text-yellow-100" dangerouslySetInnerHTML={{ __html: area }}></span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {analysis.olq_rating && (
                  <div 
                    className="p-6 backdrop-blur-sm rounded-2xl border border-purple-500/20"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #8b5cf6)' }}
                  >
                    <h3 className="font-bold text-2xl mb-6 text-purple-300 flex items-center">
                      <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Officer Like Qualities Rating
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(analysis.olq_rating).map(([key, value]) => (
                        <div 
                          key={key} 
                          className="p-4 backdrop-blur-sm rounded-xl border border-blue-400/20 hover:scale-105 transition-transform duration-300"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, #3b82f6)' }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-blue-100 capitalize font-medium">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center">
                              <span className="font-bold text-blue-200 text-xl">{value}</span>
                              <span className="text-blue-300 text-sm ml-1">/ 5</span>
                            </div>
                          </div>
                          <div className="w-full bg-blue-800/50 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-blue-400 to-cyan-400 h-3 rounded-full transition-all duration-500"
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
          
          <div className="text-center space-y-4">
            <div className="flex justify-center space-x-6">
              <button
                onClick={() => router.push('/')}
                className="px-8 py-3 backdrop-blur-xl border border-black/20 dark:border-white/30 font-semibold rounded-xl hover:border-black/40 dark:hover:border-white/50 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 hover:scale-105"
                style={{ 
                  backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)',
                  color: 'var(--foreground)'
                }}
              >
                Return to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/30 transform hover:-translate-y-0.5 hover:scale-105"
              >
                Take Test Again
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }
  
  // Loading screen shown while fetching the initial set of words
  if (words.length === 0 && testState === 'running') {
    return (
      <main 
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        style={{ 
          background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--background) 85%, #3b82f6), var(--background) 70%), var(--background)`,
          color: 'var(--foreground)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative z-10 text-center">
          <div 
            className="inline-block p-8 backdrop-blur-xl rounded-3xl border border-blue-500/20 shadow-2xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
          >
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
              Loading Test...
            </h1>
            <p className="opacity-60">Preparing your word association test</p>
          </div>
        </div>
      </main>
    );
  }

  // The main test-taking interface
  return (
    <main 
      className="min-h-screen relative overflow-hidden p-4"
      style={{ 
        background: `radial-gradient(ellipse at top, color-mix(in srgb, var(--background) 85%, #3b82f6), var(--background) 70%), var(--background)`,
        color: 'var(--foreground)'
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center">
        <div className="w-full max-w-4xl">
          {/* Header with progress bar and timer */}
          <div 
            className="mb-8 p-6 backdrop-blur-xl rounded-2xl border border-black/10 dark:border-white/20 shadow-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 85%, transparent)' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                Word Association Test
              </h1>
              <div className="flex items-center space-x-4">
                <span className="px-4 py-2 backdrop-blur-sm rounded-xl border border-blue-500/20 font-semibold text-blue-400" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, #3b82f6)' }}>
                  {currentWordIndex + 1} of {words.length}
                </span>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-4xl font-bold transition-colors duration-300 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : timeLeft <= 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {timeLeft}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div 
                className="w-full backdrop-blur-sm rounded-full h-4 border border-blue-500/20"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)' }}
              >
                <div 
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-4 rounded-full transition-all duration-500 shadow-lg shadow-blue-500/30"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-center opacity-60 text-sm font-medium">
                {progress}% Complete
              </div>
            </div>
          </div>

          {/* Current word display */}
          <div 
            className="p-12 backdrop-blur-xl rounded-2xl border border-black/10 dark:border-white/20 mb-8 hover:border-black/20 dark:hover:border-white/30 transition-all duration-300 shadow-xl text-center group"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 85%, transparent)' }}
          >
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-12 h-12 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/30">
                <span className="text-white font-bold text-lg">{currentWordIndex + 1}</span>
              </div>
              <span className="text-2xl font-medium opacity-60">React to this word:</span>
            </div>
            <h2 className="text-7xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300">
              {words[currentWordIndex]}
            </h2>
          </div>

          {/* User input area */}
          <div 
            className="backdrop-blur-xl rounded-2xl border border-black/10 dark:border-white/20 p-8 shadow-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 85%, transparent)' }}
          >
            <div className="space-y-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={currentResponse}
                  onChange={(e) => setCurrentResponse(e.target.value)}
                  placeholder="Type the first sentence that comes to mind..."
                  className="w-full px-6 py-4 backdrop-blur-sm border border-black/20 dark:border-white/20 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-black/30 dark:hover:border-white/30"
                  style={{ 
                    backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)',
                    color: 'var(--foreground)'
                  }}
                  maxLength={200}
                />
                <div className="absolute bottom-4 right-4 text-xs opacity-50 font-medium">
                  {currentResponse.length}/200
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-6 text-sm">
                  <button
                    onClick={() => {
                      setTestState('paused');
                      pauseTimer();
                    }}
                    className="flex items-center opacity-60 hover:opacity-100 transition-opacity duration-300"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pause (Esc)
                  </button>
                  {currentResponse.trim() && (
                    <button
                      onClick={handleWordComplete}
                      className="flex items-center text-green-400 hover:text-green-300 transition-colors duration-300"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit (Ctrl+Enter)
                    </button>
                  )}
                </div>
                
                <div className="text-sm opacity-60 flex items-center">
                  <kbd className="px-2 py-1 backdrop-blur-sm rounded border border-black/20 dark:border-white/20 text-xs font-medium mr-2" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)' }}>
                    Ctrl+Enter
                  </kbd>
                  to submit early
                </div>
              </div>

              <button
                onClick={handleWordComplete}
                disabled={!currentResponse.trim() || isSaving}
                className={`w-full px-8 py-4 font-semibold rounded-xl transition-all text-xl group ${
                  !currentResponse.trim() || isSaving
                    ? 'opacity-50 cursor-not-allowed backdrop-blur-sm border border-black/20 dark:border-white/20' 
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 hover:shadow-2xl hover:shadow-blue-500/30 transform hover:-translate-y-1 hover:scale-105'
                }`}
                style={!currentResponse.trim() || isSaving ? { 
                  backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)',
                  color: 'var(--foreground)'
                } : {}}
              >
                {isSaving 
                  ? (
                    <div className="flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                      Saving...
                    </div>
                  )
                  : (
                    <span className="flex items-center justify-center">
                      {currentWordIndex === words.length - 1 ? 'Finish Test' : 'Next Word'}
                      <svg className="inline-block ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  )
                }
              </button>
            </div>
          </div>

          {/* Quick tips section */}
          <div 
            className="mt-8 p-6 backdrop-blur-sm rounded-2xl border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300"
            style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, transparent)' }}
          >
            <h4 className="text-lg font-semibold mb-4 flex items-center opacity-80">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Tips
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm opacity-70">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                Write the first thing that comes to mind
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></span>
                Don't overthink your response
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-purple-400 rounded-full mr-3"></span>
                Speed matters more than perfection
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-pink-400 rounded-full mr-3"></span>
                Trust your instincts
              </div>
            </div>
          </div>

          {/* Back to dashboard link */}
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/')}
              className="opacity-50 hover:opacity-80 transition-opacity duration-300 text-sm underline decoration-blue-500/50 hover:decoration-blue-500"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
        </div>
    </main>  
  );
}