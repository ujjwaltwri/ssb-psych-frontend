'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(`Error: ${error.message}`);
    else setMessage('Sign-up successful! Please check your email for a confirmation link.');
    setIsLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(`Error: ${error.message}`);
    setIsLoading(false);
  };
  
  const handleSignOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setIsLoading(false);
  };

  // If a user is logged in, show the new dashboard view
  if (session) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-white">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-12">
            <h1 className="text-2xl font-bold text-blue-400">PsychePrep</h1>
            <div className="flex items-center">
              <span className="text-gray-400 mr-4 text-sm">{session.user.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">User Dashboard</h2>
            <p className="text-gray-400 mb-10">Select a module to begin your practice session.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* WAT Card */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
                <h3 className="text-2xl font-bold mb-3">Word Association Test</h3>
                <p className="text-gray-400 mb-6">React to 60 words under time pressure.</p>
                <Link href="/wat" className="w-full">
                  <button className="w-full px-6 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                    Start WAT Practice
                  </button>
                </Link>
              </div>
              
              {/* SRT Card */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
                <h3 className="text-2xl font-bold mb-3">Situation Reaction Test</h3>
                <p className="text-gray-400 mb-6">Respond to 60 real-life situations.</p>
                <button 
                  onClick={() => alert('SRT Simulator coming soon!')}
                  className="w-full px-6 py-3 bg-gray-700 font-semibold rounded-lg cursor-not-allowed"
                >
                  Start SRT Practice
                </button>
              </div>
              
              {/* TAT Card */}
              <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
                <h3 className="text-2xl font-bold mb-3">Thematic Apperception Test</h3>
                <p className="text-gray-400 mb-6">Write stories for 12 ambiguous pictures.</p>
                <button 
                  onClick={() => alert('TAT Simulator coming soon!')}
                  className="w-full px-6 py-3 bg-gray-700 font-semibold rounded-lg cursor-not-allowed"
                >
                  Start TAT Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // If no user is logged in, show the authentication form
  return (
     <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-6 text-center">PsychePrep</h1>
        <p className="text-gray-400 mb-6 text-center">Create an account or sign in.</p>
        <form className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md" placeholder="••••••••" required />
          </div>
          <div className="flex items-center justify-between space-x-4 pt-2">
            <button onClick={handleSignIn} disabled={isLoading} className="w-full px-4 py-2 bg-gray-600 font-semibold rounded-lg hover:bg-gray-700 disabled:bg-gray-500">
              {isLoading ? '...' : 'Sign In'}
            </button>
            <button onClick={handleSignUp} disabled={isLoading} className="w-full px-4 py-2 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500">
              {isLoading ? '...' : 'Sign Up'}
            </button>
          </div>
        </form>
        {message && <p className="mt-4 text-center text-sm text-gray-300">{message}</p>}
      </div>
    </main>
  );
}