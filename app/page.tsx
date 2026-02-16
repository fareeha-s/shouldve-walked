'use client';

import { useState, useEffect } from 'react';
import AddressInput from '@/components/AddressInput';
import Results from '@/components/Results';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import type { AnalysisResult } from '@/lib/types';
import { type ThemeName, themes } from '@/lib/themes';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>('paper');
  const [loadingMsg, setLoadingMsg] = useState(0);

  const loadingMessages = [
    'calculating what you missed...',
    'judging your life choices...',
    'consulting the fog...',
    'asking karl for directions...',
    'counting the hills you skipped...',
    'checking if it was worth it...',
  ];

  useEffect(() => {
    const saved = localStorage.getItem('sihw-theme') as ThemeName;
    if (saved && themes[saved]) setTheme(saved);
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingMsg(0); return; }
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % loadingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleThemeChange = (t: ThemeName) => {
    setTheme(t);
    localStorage.setItem('sihw-theme', t);
  };

  const handleAnalyze = async (pickup: string, dropoff: string) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, dropoff }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'something went wrong');
        return;
      }

      setResults(data);
    } catch (error) {
      console.error('Error analyzing route:', error);
      setError('failed to analyze route');
    } finally {
      setLoading(false);
    }
  };

  const themeVars = themes[theme].vars;

  return (
    <main
      className="min-h-screen transition-colors duration-300"
      style={{
        ...themeVars as React.CSSProperties,
        backgroundColor: 'var(--th-bg)',
        color: 'var(--th-text)',
      }}
    >
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-16 lg:py-24">
        <div className="mb-12 md:mb-20 pb-6 md:pb-8" style={{ borderBottom: '3px solid var(--th-border)' }}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-mono tracking-[-0.02em] font-bold leading-[0.9] uppercase">
            should i have walked.
          </h1>
        </div>

        {/* Show input at top if no results yet, or if there was an error */}
        {!results && !loading && <AddressInput onAnalyze={handleAnalyze} loading={loading} />}

        {loading && (
          <div className="mt-16 md:mt-24 text-center space-y-6">
            <div className="inline-flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: 'var(--th-text)',
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.8s',
                  }}
                />
              ))}
            </div>
            <div
              className="font-mono text-sm transition-opacity duration-500"
              style={{ color: 'var(--th-text-muted)' }}
              key={loadingMsg}
            >
              {loadingMessages[loadingMsg]}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-12 md:mt-16 py-4" style={{ borderLeft: '4px solid var(--th-error)', paddingLeft: '1.5rem', backgroundColor: 'var(--th-error-bg)' }}>
            <div className="font-mono text-sm md:text-base font-bold" style={{ color: 'var(--th-error)' }}>{error}</div>
          </div>
        )}

        {/* Show verdict first, then all results */}
        {results && !loading && (
          <>
            <section
              className="mb-12 md:mb-16 text-center py-12 md:py-20"
              style={{
                border: `3px solid ${results.verdict.worthIt ? 'var(--th-text-label)' : '#27ae60'}`,
                boxShadow: 'var(--th-shadow-lg)',
                backgroundColor: results.verdict.worthIt ? 'var(--th-surface-alt)' : 'rgba(39,174,96,0.08)',
              }}
            >
              <div className="font-mono text-xs uppercase tracking-[0.25em] mb-3" style={{ color: 'var(--th-text-label)' }}>should you have walked?</div>
              <div
                className="text-5xl md:text-7xl lg:text-8xl font-mono font-bold tracking-tight mb-4"
                style={{ color: results.verdict.worthIt ? 'var(--th-text-label)' : '#27ae60' }}
              >
                {results.verdict.worthIt ? 'no.' : 'yes.'}
              </div>
              <div
                className="text-base md:text-xl lg:text-2xl font-serif italic leading-relaxed px-4"
                style={{ color: results.verdict.worthIt ? 'var(--th-text-faint)' : 'rgba(39,174,96,0.7)' }}
              >
                {results.verdict.reason}
              </div>
              {results.weather.condition !== 'unknown' && (
                <div className="text-sm font-mono mt-7" style={{ color: 'var(--th-text-label)' }}>
                  {results.weather.temperature}&deg;F / {Math.round((results.weather.temperature - 32) * 5 / 9)}&deg;C &bull; {results.weather.condition === 'foggy' ? 'foggy (karl says hi)' : results.weather.condition}
                </div>
              )}
            </section>

            <Results data={results} />

            {/* Try another route at bottom */}
            <div className="mt-16 md:mt-20 pt-16 md:pt-20" style={{ borderTop: '3px solid var(--th-border)' }}>
              <h2 className="text-xs font-mono uppercase tracking-[0.25em] mb-6 text-center" style={{ color: 'var(--th-text-label)' }}>try a different route</h2>
              <AddressInput onAnalyze={handleAnalyze} loading={false} />
            </div>
          </>
        )}

        {/* Subtle credit */}
        <div className="mt-20 mb-8 text-center space-y-3">
          <a 
            href="https://x.com/fareehasala/status/2022844579331105191?s=20" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[11px] font-mono tracking-wider transition-colors"
            style={{ color: 'var(--th-text-faint)' }}
          >
            made by Fareeha in the backseat of the robotaxi ♡
          </a>
          <div className="flex justify-center">
            <ThemeSwitcher current={theme} onChange={handleThemeChange} />
          </div>
        </div>
      </div>
    </main>
  );
}
