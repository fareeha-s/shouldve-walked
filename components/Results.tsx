'use client';

import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '@/lib/types';
import RouteMap from './RouteMap';

interface ResultsProps {
  data: AnalysisResult;
}

export default function Results({ data }: ResultsProps) {
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [data]);

  return (
    <div ref={resultsRef} className="mt-16 space-y-12 animate-in fade-in duration-500">
      {/* Health Stats */}
      <section className="border border-[#2a2a2a] bg-[#0f0f0f] p-6 md:p-8">
        <h2 className="text-xl font-mono mb-6 text-[#ededed]">stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 font-mono text-sm">
          <div>
            <div className="text-[#a0a0a0] mb-1">walk time</div>
            <div className="text-2xl">{data.healthStats.walkTimeMinutes} min</div>
          </div>
          <div>
            <div className="text-[#a0a0a0] mb-1">waymo time</div>
            <div className="text-2xl">{data.healthStats.waymoTimeMinutes} min</div>
          </div>
          <div>
            <div className="text-[#a0a0a0] mb-1">steps</div>
            <div className="text-2xl">{data.healthStats.steps.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[#a0a0a0] mb-1">calories</div>
            <div className="text-2xl">{data.healthStats.caloriesBurned}</div>
            <div className="text-[#666] text-xs mt-1">{data.healthStats.foodEquivalent}</div>
          </div>
          <div>
            <div className="text-[#a0a0a0] mb-1">exercise</div>
            <div className="text-2xl">{data.healthStats.exerciseMinutes} min</div>
            <div className="text-[#666] text-xs mt-1">
              {data.healthStats.exercisePercentage}% of daily goal
            </div>
          </div>
          <div>
            <div className="text-[#a0a0a0] mb-1">guilt score</div>
            <div className="text-2xl">{data.healthStats.guiltScore}/10</div>
          </div>
        </div>
      </section>

      {/* Time Comparisons */}
      <section>
        <h2 className="text-xl font-mono mb-6">that&apos;s {data.healthStats.walkTimeMinutes} min</h2>
        <div className="space-y-3">
          {data.timeComparisons.map((comparison, index) => (
            <div
              key={index}
              className="border-l-2 border-[#2a2a2a] pl-4 py-2 text-[#a0a0a0] font-mono text-sm"
            >
              {comparison.text}
            </div>
          ))}
        </div>
      </section>

      {/* Map */}
      <section>
        <h2 className="text-xl font-mono mb-6">the route</h2>
        <RouteMap data={data} />
      </section>

      {/* Points of Interest */}
      <section>
        <h2 className="text-xl font-mono mb-6">what you missed</h2>
        <div className="space-y-3">
          {data.pointsOfInterest.map((poi, index) => (
            <div
              key={index}
              className="border border-[#2a2a2a] bg-[#0f0f0f] p-4"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="font-mono text-sm text-[#ededed] mb-1">{poi.name}</div>
                  <div className="text-sm text-[#a0a0a0]">{poi.description}</div>
                </div>
                <div className="text-xs font-mono text-[#666] uppercase">{poi.type}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Warnings */}
      {data.safetyWarnings.length > 0 && (
        <section>
          <h2 className="text-xl font-mono mb-6">real talk</h2>
          <div className="space-y-3">
            {data.safetyWarnings.map((warning, index) => (
              <div
                key={index}
                className="border-l-2 border-[#ff6b6b] pl-4 py-2 text-[#ff6b6b] font-mono text-sm"
              >
                <span className="text-[#a0a0a0]">{warning.area}:</span> {warning.warning}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
