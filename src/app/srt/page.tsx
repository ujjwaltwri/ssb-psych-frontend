'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

export default function SrtTestPage() {
  const [testState, setTestState] = useState<TestState>('ready');
  const [situations, setSituations] = useState<string[]>([]);
  const [currentSituationIndex, setCurrentSituationIndex] = useState(0);
  const [currentResponse, setCurrentResponse] = useState('');
  const [allResponses, setAllResponses] = useState<{ situation: string, response: string }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const saveSessionAndFinish = useCallback(async (finalResponses: { situation: string, response: string }[]) => {
    setTestState('finished');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      const token = session.access_token;
      const response = await fetch(`${apiUrl}/api/save-srt-session`, {
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

  const handleNext = useCallback(() => {
    const newResponses = [...allResponses, { situation: situations[currentSituationIndex], response: currentResponse }];
    
    if (currentSituationIndex === situations.length - 1) {
      setAllResponses(newResponses);
      saveSessionAndFinish(newResponses);
    } else {
      setAllResponses(newResponses);
      setCurrentResponse('');
      setCurrentSituationIndex(prevIndex => prevIndex + 1);
    }
  }, [allResponses, situations, currentSituationIndex, currentResponse, saveSessionAndFinish]);

  useEffect(() => {
    if (testState === 'running' && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [currentSituationIndex, testState]);

  const startTest = async () => {
    setAnalysis(null);
    setSessionId(null);
    setAllResponses([]);
    setCurrentSituationIndex(0);
    setCurrentResponse('');
    setTestState('running');
    try {
      const response = await fetch(`${apiUrl}/api/new-srt-test`);
      const data = await response.json();
      if (Array.isArray(data.situations)) {
        setSituations(data.situations);
      } else {
        throw new Error("Invalid data format from API");
      }
    } catch (error) {
      console.error("Failed to fetch situations:", error);
      alert("Could not start the test. Please ensure the backend server is running correctly.");
      setTestState('ready');
    }
  };

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

  if (testState === 'ready') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
        <h1 className="text-4xl font-bold text-center">Situation Reaction Test</h1>
        <p className="text-gray-400 mt-4 text-center max-w-xl">
          You will be presented with a series of situations. For each one, write your reaction, describing what you would do.
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
                  <p className='text-gray-300 italic'>{`"${analysis.final_verdict}"`}</p>
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
            className="mt-12 px-8 py-3 bg-gray-600 font-semibold rounded-lg hover:bg-gray-700"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (testState === 'running' && situations.length === 0) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
          <h1 className="text-3xl font-bold animate-pulse">Loading Test...</h1>
        </main>
      );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-blue-400">Situation Reaction Test</h1>
          <span className="text-gray-400 font-semibold">Situation {currentSituationIndex + 1} of {situations.length}</span>
        </div>
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg mb-4">
          <p className="text-lg text-gray-300">{situations[currentSituationIndex]}</p>
        </div>
        <textarea
          ref={textAreaRef}
          value={currentResponse}
          onChange={(e) => setCurrentResponse(e.target.value)}
          placeholder="Type your reaction here..."
          rows={4}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleNext}
          className="mt-6 w-full px-8 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors text-xl"
        >
          {currentSituationIndex === situations.length - 1 ? 'Finish Test' : 'Next Situation'}
        </button>
      </div>
    </main>
  );
}