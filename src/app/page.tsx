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
      if (session?.user?.email_confirmed_at) {
        setSession(session);
      } else {
        setSession(null);
      }
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
  
  const handleGuestSignIn = async () => {
    setIsLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setMessage(`Error: ${error.message}`);
    setIsLoading(false);
  };
  
  const handleSignOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setIsLoading(false);
  };

  if (session) {
    return (
      <main 
        className="min-h-screen relative overflow-hidden"
        style={{ 
          background: `radial-gradient(ellipse at top, color-mix(in srgb, var(--background) 85%, #8b5cf6), var(--background) 70%), var(--background)`,
          color: 'var(--foreground)'
        }}
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>
        
        <div className="relative z-10 flex min-h-screen flex-col items-center p-8">
          <div className="w-full max-w-6xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-16">
              <div className="group cursor-pointer">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300">
                  PsychePrep
                </h1>
                <div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"></div>
              </div>
              <div 
                className="flex items-center backdrop-blur-sm rounded-2xl px-6 py-3 border border-black/10 dark:border-white/20"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)' }}
              >
                <span className="mr-4 text-sm opacity-70">
                  {session.user.is_anonymous ? (
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Guest User
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      {session.user.email}
                    </span>
                  )}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Sign Out'
                  )}
                </button>
              </div>
            </div>

            {/* Main content */}
            <div className="text-center mb-16">
              <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Welcome Back
              </h2>
              <p className="text-xl opacity-70 max-w-2xl mx-auto leading-relaxed">
                Ready to enhance your psychological assessment skills? Choose a module and start your practice journey.
              </p>
            </div>

            {/* Test modules grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* WAT Module */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                <div 
                  className="relative p-8 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl hover:border-black/20 dark:hover:border-white/20 transition-all duration-500 hover:transform hover:scale-105"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
                >
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl mb-6 group-hover:rotate-12 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-blue-500 transition-colors duration-300">
                    Word Association Test
                  </h3>
                  <p className="opacity-70 mb-8 leading-relaxed">
                    Quick reflexes meet psychology. React to 60 words under time pressure and discover your subconscious patterns.
                  </p>
                  <Link href="/wat" className="block">
                    <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/30 transform hover:-translate-y-1">
                      Start WAT Practice
                      <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </Link>
                </div>
              </div>

              {/* SRT Module */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                <div 
                  className="relative p-8 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl hover:border-black/20 dark:hover:border-white/20 transition-all duration-500 hover:transform hover:scale-105"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
                >
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 group-hover:rotate-12 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-purple-500 transition-colors duration-300">
                    Situation Reaction Test
                  </h3>
                  <p className="opacity-70 mb-8 leading-relaxed">
                    Navigate complex scenarios with wisdom. Respond to 60 real-life situations and showcase your decision-making prowess.
                  </p>
                  <Link href="/srt" className="block">
                    <button className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/30 transform hover:-translate-y-1">
                      Start SRT Practice
                      <svg className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </Link>
                </div>
              </div>

              {/* TAT Module */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                <div 
                  className="relative p-8 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl hover:border-black/20 dark:hover:border-white/20 transition-all duration-500 hover:transform hover:scale-105"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, transparent)' }}
                >
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl mb-6 group-hover:rotate-12 transition-transform duration-300 opacity-70">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 opacity-70 group-hover:text-amber-500 transition-colors duration-300">
                    Thematic Apperception Test
                  </h3>
                  <p className="opacity-50 mb-8 leading-relaxed">
                    Unleash your storytelling imagination. Create compelling narratives for 12 ambiguous pictures and reveal deeper insights.
                  </p>
                  <button 
                    onClick={() => alert('TAT Simulator coming soon!')}
                    className="w-full px-6 py-4 bg-gradient-to-r from-amber-600/50 to-orange-600/50 text-white font-semibold rounded-xl cursor-not-allowed relative overflow-hidden group-hover:from-amber-600/70 group-hover:to-orange-600/70 transition-all duration-300"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      Coming Soon
                      <svg className="inline-block ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000"></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Stats section */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div 
                className="p-6 backdrop-blur-sm rounded-2xl border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)' }}
              >
                <div className="text-3xl font-bold text-blue-500 mb-2">60</div>
                <div className="opacity-60">Test Questions</div>
              </div>
              <div 
                className="p-6 backdrop-blur-sm rounded-2xl border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)' }}
              >
                <div className="text-3xl font-bold text-purple-500 mb-2">3</div>
                <div className="opacity-60">Assessment Modules</div>
              </div>
              <div 
                className="p-6 backdrop-blur-sm rounded-2xl border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)' }}
              >
                <div className="text-3xl font-bold text-pink-500 mb-2">∞</div>
                <div className="opacity-60">Practice Sessions</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main 
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ 
        background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--background) 85%, #8b5cf6), var(--background) 70%), var(--background)`,
        color: 'var(--foreground)'
      }}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10 dark:opacity-15">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        {/* Logo section */}
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mb-6 hover:rotate-6 transition-transform duration-300 hover:scale-110">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            PsychePrep
          </h1>
          <p className="opacity-70 text-lg">Master your mind, ace your assessments</p>
        </div>
        
        {/* Auth form */}
        <div 
          className="backdrop-blur-xl p-8 rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl hover:border-black/20 dark:hover:border-white/30 transition-all duration-500"
          style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
        >
          <form className="space-y-6">
            <div className="space-y-4">
              <div className="group">
                <label htmlFor="email" className="block text-sm font-medium opacity-70 mb-2 group-hover:opacity-100 transition-opacity duration-200">
                  Email Address
                </label>
                <input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-3 backdrop-blur-sm border border-black/20 dark:border-white/20 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-black/30 dark:hover:border-white/30"
                  style={{ 
                    backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)',
                    color: 'var(--foreground)'
                  }}
                  placeholder="you@example.com" 
                  required 
                />
              </div>
              <div className="group">
                <label htmlFor="password" className="block text-sm font-medium opacity-70 mb-2 group-hover:opacity-100 transition-opacity duration-200">
                  Password
                </label>
                <input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-4 py-3 backdrop-blur-sm border border-black/20 dark:border-white/20 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-black/30 dark:hover:border-white/30"
                  style={{ 
                    backgroundColor: 'color-mix(in srgb, var(--background) 70%, transparent)',
                    color: 'var(--foreground)'
                  }}
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button 
                onClick={handleSignIn} 
                disabled={isLoading} 
                className="flex-1 px-6 py-3 border-2 border-black/20 dark:border-white/30 font-semibold rounded-xl hover:border-black/40 dark:hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 hover:scale-105"
                style={{ 
                  backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)',
                  color: 'var(--foreground)'
                }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin mx-auto"></div>
                ) : (
                  'Sign In'
                )}
              </button>
              <button 
                onClick={handleSignUp} 
                disabled={isLoading} 
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 transform hover:-translate-y-0.5 hover:scale-105"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
          </form>
          
          <div className="my-8 flex items-center">
            <div className="flex-grow border-t border-black/20 dark:border-white/20"></div>
            <span className="flex-shrink mx-4 opacity-60 font-medium">OR</span>
            <div className="flex-grow border-t border-black/20 dark:border-white/20"></div>
          </div>

          <button
            onClick={handleGuestSignIn}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 transform hover:-translate-y-0.5 hover:scale-105 group"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Continue as Guest
              </span>
            )}
          </button>

          {message && (
            <div 
              className={`mt-6 p-4 rounded-xl text-center text-sm backdrop-blur-sm border transition-all duration-300 ${
                message.includes('Error') 
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 dark:text-red-300' 
                  : 'bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-400'
              }`}
            >
              {message}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="text-center mt-8 opacity-50 text-sm">
          <p className="hover:opacity-80 transition-opacity duration-300">
            Prepare for psychological assessments with confidence
          </p>
        </div>
      </div>
    </main>
  );
}