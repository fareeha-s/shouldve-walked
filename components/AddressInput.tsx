'use client';

import { useState } from 'react';

interface AddressInputProps {
  onAnalyze: (pickup: string, dropoff: string) => void;
  loading: boolean;
}

export default function AddressInput({ onAnalyze, loading }: AddressInputProps) {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pickup && dropoff && !loading) {
      onAnalyze(pickup, dropoff);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pickup" className="block text-sm font-mono text-[#a0a0a0] mb-2">
          pickup
        </label>
        <input
          id="pickup"
          type="text"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          placeholder="where you were"
          className="w-full bg-[#151515] border border-[#2a2a2a] rounded px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#404040] transition-colors"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="dropoff" className="block text-sm font-mono text-[#a0a0a0] mb-2">
          dropoff
        </label>
        <input
          id="dropoff"
          type="text"
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
          placeholder="where you needed to be"
          className="w-full bg-[#151515] border border-[#2a2a2a] rounded px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#404040] transition-colors"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={!pickup || !dropoff || loading}
        className="w-full bg-[#ededed] text-[#0a0a0a] py-3 px-6 font-mono text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-colors"
      >
        {loading ? 'calculating...' : 'show me what i missed'}
      </button>
    </form>
  );
}
