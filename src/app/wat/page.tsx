'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type TestState = 'ready' | 'running' | 'finished';

interface Analysis {
  overall_summary?: string;
  positive_traits?: string[];
  areas_for_improvement?: string[];
  final_verdict?: string;
  olq_rating?: { [key: string]: number };
}

export default function WatTestPage() {
  const [testState, setTestState] = useState<TestState>('ready');
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [currentResponse, setCurrentResponse] = useState('');
  const [allResponses, setAllResponses] = useState<{ word: string, response: string }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const saveSessionAndFinish = useCallback(async (finalResponses: { word: string, response: string }[]) => {
    setTestState('finished');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/save-wat-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ responses: finalResponses }),
      });
      if (!response.ok) throw new Error('Failed to save session');
      const result = await response.json();
      setSessionId(result.data.id);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (testState !== 'running' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [testState, timeLeft]);

  useEffect(() => {
    if (testState === 'running' && words.length > 0 && timeLeft <= 0) {
      const newResponses = [...allResponses, { word: words[currentWordIndex], response: currentResponse }];
      setAllResponses(newResponses);
      setCurrentResponse('');

      if (currentWordIndex === words.length - 1) {
        saveSessionAndFinish(newResponses);
      } else {
        setCurrentWordIndex(prevIndex => prevIndex + 1);
        setTimeLeft(15);
      }
    }
  }, [timeLeft, testState, words, allResponses, currentResponse, currentWordIndex, saveSessionAndFinish]);

  useEffect(() => {
    if (testState === 'running' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentWordIndex, testState]);

  const handleAnalysis = async () => {
    if (!sessionId) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/analyze-session/${sessionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Failed to get analysis'); }
      const result = await response.json();
      setAnalysis(result.analysis);
    } catch (error) {
      console.error('Error getting analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startTest = async () => {
    setAnalysis(null);
    setSessionId(null);
    setAllResponses([]);
    setCurrentWordIndex(0);
    setCurrentResponse('');
    setTimeLeft(15);
    setTestState('running');
    try {
        const response = await fetch(`${apiUrl}/api/new-wat-test`);
        const data = await response.json();
        setWords(data.words);
    } catch (error) {
        console.error("Failed to fetch words", error);
        alert("Could not start the test. Ensure your backend is running and the API URL is correct.");
        setTestState('ready');
    }
  };

  if (testState === 'ready') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <h1 className="text-4xl font-bold text-center">Word Association Test</h1>
        <p className="text-gray-400 mt-4 text-center max-w-xl">
          You will be shown a series of words. For each one, you have 15 seconds to write the first sentence that comes to mind.
        </p>
        <button
          onClick={startTest}
          className="mt-8 px-8 py-4 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors text-xl"
        >
          Start Test
        </button>
      </main>
    );
  }

  if (testState === 'finished') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <div className="text-center w-full max-w-3xl">
          <h1 className="text-4xl font-bold">Test Complete!</h1>
          <p className="text-gray-400 mt-2 mb-8">Your responses have been saved.</p>
          
          {!analysis && !isAnalyzing && (
            <button
              onClick={handleAnalysis}
              className="px-8 py-4 bg-green-600 font-semibold rounded-lg hover:bg-green-700 transition-colors text-xl animate-pulse"
            >
              Analyze My Responses
            </button>
          )}

          {isAnalyzing && <p className="text-2xl animate-pulse">AI is analyzing your responses...</p>}

          {analysis && (
            <div className="mt-8 p-8 border border-gray-700 rounded-lg bg-gray-800 text-left">
              <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">AI Feedback Report</h2>
              <div className="space-y-6">
                
                {analysis.overall_summary && <div>
                  <h3 className="font-bold text-xl mb-2">Overall Summary</h3>
                  <p className="text-gray-300">{analysis.overall_summary}</p>
                </div>}

                {analysis.final_verdict && <div className="p-4 bg-gray-900 border border-red-500/50 rounded-lg">
                  <h3 className="font-bold text-xl mb-2 text-red-400">Final Verdict</h3>
                  <p className='text-gray-300 italic'>"{analysis.final_verdict}"</p>
                </div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {analysis.positive_traits && <div>
                      <h3 className="font-bold text-xl mb-2">Positive Traits</h3>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {analysis.positive_traits.map((trait, i) => <li key={i} dangerouslySetInnerHTML={{ __html: trait }}></li>)}
                      </ul>
                    </div>}
                    {analysis.areas_for_improvement && <div>
                      <h3 className="font-bold text-xl mb-2">Areas for Improvement</h3>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {analysis.areas_for_improvement.map((area, i) => <li key={i} dangerouslySetInnerHTML={{ __html: area }}></li>)}
                      </ul>
                    </div>}
                </div>
                
                {analysis.olq_rating && <div>
                  <h3 className="font-bold text-xl mb-3">Officer Like Qualities (Rating: 1-5)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
                    {Object.entries(analysis.olq_rating).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-bold text-blue-400">{value} / 5</span>
                      </div>
                    ))}
                  </div>
                </div>}
              </div>
            </div>
          )}
          
          <button
            onClick={() => router.push('/')}
            className="mt-12 px-8 py-3 bg-gray-600 font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }
  
  if (words.length === 0 && testState === 'running') {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
          <h1 className="text-3xl font-bold animate-pulse">Loading Test...</h1>
        </main>
      );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="w-full max-w-2xl text-center">
        <div className="flex justify-between items-baseline mb-8">
          <span className="text-gray-400">Word {currentWordIndex + 1} of {words.length}</span>
          <span className="text-5xl font-bold text-red-500">{timeLeft}</span>
        </div>
        <div className="mb-8 p-12 bg-gray-800 rounded-lg">
          <h2 className="text-6xl font-bold">{words[currentWordIndex]}</h2>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={currentResponse}
          onChange={(e) => setCurrentResponse(e.target.value)}
          placeholder="Type your response here..."
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </main>
  );
}