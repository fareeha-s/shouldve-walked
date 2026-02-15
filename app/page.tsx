'use client';

import { useState } from 'react';
import AddressInput from '@/components/AddressInput';
import Results from '@/components/Results';
import type { AnalysisResult } from '@/lib/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        <div className="mb-12 md:mb-16">
          <h1 className="text-4xl md:text-5xl font-mono mb-3 tracking-tight">
            what you missed
          </h1>
          <p className="text-[#a0a0a0] text-sm md:text-base font-mono">
            a playful guilt trip for people who take robotaxis six blocks
          </p>
        </div>

        <AddressInput onAnalyze={handleAnalyze} loading={loading} />

        {loading && (
          <div className="mt-12 text-center">
            <div className="inline-block animate-pulse font-mono text-[#a0a0a0]">
              calculating what you missed...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="mt-12 border-l-2 border-[#ff6b6b] pl-4 py-3">
            <div className="font-mono text-sm text-[#ff6b6b]">{error}</div>
          </div>
        )}

        {results && !loading && <Results data={results} />}
      </div>
    </main>
  );
}
