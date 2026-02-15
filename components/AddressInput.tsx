'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface AddressInputProps {
  onAnalyze: (pickup: string, dropoff: string) => void;
  loading: boolean;
}

export default function AddressInput({ onAnalyze, loading }: AddressInputProps) {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initAutocomplete = async () => {
      if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;

      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places'],
      });

      await loader.load();

      if (window.google && pickupInputRef.current && dropoffInputRef.current) {
        const options = {
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'name'],
          types: ['establishment', 'geocode'],
        };

        const pickupAutocomplete = new window.google.maps.places.Autocomplete(
          pickupInputRef.current,
          options
        );

        const dropoffAutocomplete = new window.google.maps.places.Autocomplete(
          dropoffInputRef.current,
          options
        );

        pickupAutocomplete.addListener('place_changed', () => {
          const place = pickupAutocomplete.getPlace();
          if (place.formatted_address) {
            setPickup(place.formatted_address);
          } else if (place.name) {
            setPickup(place.name);
          }
        });

        dropoffAutocomplete.addListener('place_changed', () => {
          const place = dropoffAutocomplete.getPlace();
          if (place.formatted_address) {
            setDropoff(place.formatted_address);
          } else if (place.name) {
            setDropoff(place.name);
          }
        });
      }
    };

    initAutocomplete();
  }, []);

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
          ref={pickupInputRef}
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
          ref={dropoffInputRef}
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
