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
  const [pickupValid, setPickupValid] = useState(false);
  const [dropoffValid, setDropoffValid] = useState(false);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initAutocomplete = async () => {
      if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;

      // Check if Google Maps is already loaded
      if (!window.google) {
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['places', 'geometry'],
        });

        await loader.load();
      }

      if (window.google && pickupInputRef.current && dropoffInputRef.current) {
        // Bay Area bounding box for autocomplete
        const bayAreaBounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(36.9, -123.0), // SW corner
          new window.google.maps.LatLng(38.2, -121.2)  // NE corner
        );

        const options = {
          bounds: bayAreaBounds,
          strictBounds: true, // Only show results within bounds
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'name', 'types', 'address_components'],
        };

        const pickupAutocomplete = new window.google.maps.places.Autocomplete(
          pickupInputRef.current,
          options
        );

        const dropoffAutocomplete = new window.google.maps.places.Autocomplete(
          dropoffInputRef.current,
          options
        );

        // Helper to validate and set place
        const handlePlaceSelect = (
          place: google.maps.places.PlaceResult,
          setter: (value: string) => void,
          validSetter: (valid: boolean) => void
        ) => {
          // Reject if it's ONLY a generic area (no specific types at all)
          const genericTypes = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country', 'postal_code', 'political', 'geocode'];
          const hasOnlyGenericTypes = place.types?.every(type => genericTypes.includes(type));

          if (hasOnlyGenericTypes) {
            alert('please enter a specific address or location, not just a city or area');
            setter('');
            validSetter(false);
            return;
          }

          // Just use formatted_address like Google Maps does
          // Only exception: if it's too generic (just "San Francisco"), construct better address
          if (place.formatted_address) {
            const cityOnlyPattern = /^San Francisco,?\s*(CA|California)?\s*$/i;
            if (cityOnlyPattern.test(place.formatted_address.trim()) && place.name) {
              // Generic address, construct better one
              setter(`${place.name}, San Francisco, CA`);
            } else {
              // Use what Google provides
              setter(place.formatted_address);
            }
            validSetter(true);
          } else if (place.name) {
            setter(place.name);
            validSetter(true);
          }
        };

        pickupAutocomplete.addListener('place_changed', () => {
          const place = pickupAutocomplete.getPlace();
          handlePlaceSelect(place, setPickup, setPickupValid);
        });

        dropoffAutocomplete.addListener('place_changed', () => {
          const place = dropoffAutocomplete.getPlace();
          handlePlaceSelect(place, setDropoff, setDropoffValid);
        });
      }
    };

    initAutocomplete();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pickupValid || !dropoffValid) {
      alert('please select both locations from the dropdown suggestions');
      return;
    }

    if (pickup && dropoff && !loading) {
      onAnalyze(pickup, dropoff);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
      <div>
        <label htmlFor="pickup" className="block text-xs font-mono text-[#7f8c8d] mb-2 uppercase tracking-[0.2em]">
          pickup
        </label>
        <input
          ref={pickupInputRef}
          id="pickup"
          type="text"
          value={pickup}
          onChange={(e) => {
            setPickup(e.target.value);
            setPickupValid(false); // Invalidate when manually typing
          }}
          placeholder="dolores park, ferry building, blue bottle..."
          className="w-full bg-white border-[3px] border-black px-4 py-3 md:py-4 font-mono text-sm md:text-base font-semibold focus:outline-none focus:border-[#3498db] transition-all placeholder:text-[#bdc3c7]"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="dropoff" className="block text-xs font-mono text-[#7f8c8d] mb-2 uppercase tracking-[0.2em]">
          dropoff
        </label>
        <input
          ref={dropoffInputRef}
          id="dropoff"
          type="text"
          value={dropoff}
          onChange={(e) => {
            setDropoff(e.target.value);
            setDropoffValid(false); // Invalidate when manually typing
          }}
          placeholder="civic center, tartine, where you needed to be..."
          className="w-full bg-white border-[3px] border-black px-4 py-3 md:py-4 font-mono text-sm md:text-base font-semibold focus:outline-none focus:border-[#3498db] transition-all placeholder:text-[#bdc3c7]"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={!pickup || !dropoff || !pickupValid || !dropoffValid || loading}
        className="w-full bg-black text-white py-3 md:py-4 px-6 font-mono text-sm md:text-base font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2c3e50] hover:scale-[1.02] active:scale-[0.98] transition-all border-[3px] border-black uppercase tracking-wide"
      >
        {loading ? 'calculating...' : 'go'}
      </button>
    </form>
  );
}
