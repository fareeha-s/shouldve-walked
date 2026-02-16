'use client';

import { useState, useRef, useEffect } from 'react';
import AddressInput from '@/components/AddressInput';
import type { AnalysisResult } from '@/lib/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verdictRef = useRef<HTMLDivElement>(null);

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

  // Scroll to verdict when results appear
  useEffect(() => {
    if (results && verdictRef.current) {
      verdictRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  return (
    <main className="min-h-screen bg-[#f5f5f0] text-black">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-16 lg:py-24">
        <div className="mb-12 md:mb-20 border-b-[3px] border-black pb-6 md:pb-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-mono tracking-[-0.02em] font-bold leading-[0.9] uppercase">
            should i have walked.
          </h1>
        </div>

        {/* Show input at top only if no results yet */}
        {!results && !loading && <AddressInput onAnalyze={handleAnalyze} loading={loading} />}

        {loading && (
          <div className="mt-12 md:mt-16 text-center">
            <div className="inline-block animate-pulse font-mono text-black text-sm">
              calculating what you missed...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-12 md:mt-16 border-l-[4px] border-[#e74c3c] pl-4 md:pl-6 py-4 bg-[#fff5f5]">
            <div className="font-mono text-sm md:text-base text-[#e74c3c] font-bold">{error}</div>
          </div>
        )}

        {/* Show verdict if we have results */}
        {results && !loading && (
          <>
            <section ref={verdictRef} className={`mb-12 md:mb-16 text-center py-12 md:py-20 border-[3px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${results.verdict.worthIt ? 'border-[#27ae60] bg-gradient-to-br from-[#e8f8f0] to-[#d5f4e6]' : 'border-[#f39c12] bg-gradient-to-br from-[#fef9f3] to-[#fdecd0]'}`}>
              <div className="text-[#888] font-mono text-xs uppercase tracking-[0.25em] mb-5">verdict</div>
              <div className={`text-xl md:text-3xl lg:text-4xl font-serif leading-relaxed px-4 ${results.verdict.worthIt ? 'text-[#27ae60]' : 'text-[#e67e22]'}`}>
                {results.verdict.reason}
              </div>
              {results.weather.condition !== 'unknown' && (
                <div className="text-sm font-mono text-[#666] mt-7">
                  {results.weather.temperature}° • {results.weather.condition}
                </div>
              )}
            </section>

            {/* Try another route at bottom */}
            <div className="mt-16 md:mt-20 pt-16 md:pt-20 border-t-[3px] border-black">
              <h2 className="text-xs font-mono text-[#888] uppercase tracking-[0.25em] mb-6 text-center">try a different route</h2>
              <AddressInput onAnalyze={handleAnalyze} loading={false} />
            </div>
          </>
        )}

        {/* Subtle credit */}
        <div className="mt-20 mb-8 text-center">
          <a 
            href="https://fareeha.sh" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[9px] font-mono text-[#c5c5c0] hover:text-[#999] transition-colors tracking-wide opacity-40"
          >
            made by Fareeha in the backseat of the robotaxi
          </a>
        </div>
      </div>
    </main>
  );
}
