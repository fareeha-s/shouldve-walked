'use client';

import type { AnalysisResult } from '@/lib/types';
import RouteMap from './RouteMap';

interface ResultsProps {
  data: AnalysisResult;
}

export default function Results({ data }: ResultsProps) {
  return (
    <div className="mt-12 md:mt-20 space-y-8 md:space-y-16 animate-in fade-in duration-500">

      {/* Safety Warnings - Show first if exists */}
      {data.safetyWarnings.length > 0 && (
        <section className="border-[3px] border-[#e74c3c] bg-gradient-to-br from-[#fff5f5] to-[#ffe8e6] p-6 md:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-base md:text-lg font-mono font-semibold mb-4 md:mb-6 text-[#c0392b] uppercase tracking-[0.2em]">real talk though</h2>
          <div className="space-y-3">
            {data.safetyWarnings.map((warning, index) => (
              <div
                key={index}
                className="text-sm md:text-base font-mono text-[#2c3e50] leading-relaxed"
              >
                {warning.warning}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Map with walk time overlay */}
      <section className="relative">
        <h2 className="text-xs font-mono text-[#888] uppercase tracking-[0.25em] mb-5">the route</h2>
        <div className="relative">
          <RouteMap data={data} />
          <div className="absolute bottom-4 right-4 bg-white border-[3px] border-black px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-2xl md:text-3xl font-mono font-bold tracking-tight text-black leading-none">
              {data.healthStats.walkTimeMinutes}
            </div>
            <div className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mt-1">
              min walk
            </div>
          </div>
        </div>
      </section>

      {/* Points of Interest */}
      {data.pointsOfInterest.length > 0 ? (
        <section>
          <h2 className="text-xs font-mono text-[#888] uppercase tracking-[0.25em] mb-6">what you missed</h2>
          {/* Mobile: stacked list / Desktop: grid of boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {data.pointsOfInterest.map((poi, index) => (
              <div
                key={index}
                className="border-[3px] border-black bg-white p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-mono text-sm font-semibold text-[#2c3e50] leading-tight">
                    {poi.name}
                  </div>
                  {poi.type !== 'nature' && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name + " San Francisco")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-6 h-6 border-[2px] border-black bg-white hover:bg-[#f1c40f] transition-colors flex items-center justify-center text-[10px]"
                      title="view on map"
                    >
                      &#8599;
                    </a>
                  )}
                </div>
                <div className="text-[10px] font-mono text-[#999] uppercase tracking-[0.15em] mb-2">
                  {poi.type === 'viewpoint' ? 'landmark' : poi.type === 'art' ? 'art & culture' : poi.type === 'coffee' ? 'cafe' : poi.type === 'nature' ? 'nature' : poi.type}
                </div>
                <div className="text-xs text-[#555] leading-relaxed mt-auto">{poi.description}</div>
              </div>
            ))}

            {/* Also missed: exercise and time */}
            <div className="border-[3px] border-black bg-gradient-to-br from-white to-[#fef9f3] p-6 md:p-8 mt-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-base md:text-lg font-mono font-semibold text-[#2c3e50] mb-4">
                also missed
              </div>
              <div className="space-y-3">
                <div className="text-lg md:text-xl font-mono text-black leading-relaxed">
                  {data.healthStats.exerciseEquivalent}
                </div>
                {data.timeComparisons.length > 0 && data.timeComparisons[0].text && (
                  <div className="text-sm md:text-base font-mono text-[#7f8c8d] leading-relaxed">
                    {data.timeComparisons[0].text}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="text-center py-10 border-[3px] border-dashed border-[#bdc3c7] bg-[#f8f9fa]">
          <div className="text-sm font-mono text-[#7f8c8d]">
            you missed: nothing. just beige buildings and parked cars
          </div>
        </section>
      )}

      {/* Neighborhoods */}
      {data.neighborhoods.length > 0 && (
        <section>
          <h2 className="text-xs font-mono text-[#888] uppercase tracking-[0.25em] mb-5">neighborhoods</h2>
          <div className="grid grid-cols-2 md:flex md:justify-center gap-2 md:gap-3">
            {data.neighborhoods.map((neighborhood, index) => (
              <div
                key={index}
                className="px-3 md:px-4 py-2 md:py-2.5 border-[3px] border-black bg-white font-mono text-xs md:text-sm font-semibold hover:bg-[#f1c40f] hover:border-[#f39c12] transition-all text-center"
              >
                {neighborhood}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key stats at bottom */}
      <section className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="border-[3px] border-black bg-gradient-to-br from-white to-[#f8f8f8] p-4 md:p-6 text-center hover:border-[#e67e22] transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-3xl md:text-5xl font-mono font-bold mb-2 tracking-tight">{data.healthStats.steps.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-mono text-[#555] uppercase tracking-[0.2em]">steps missed</div>
        </div>
        <div className="border-[3px] border-black bg-gradient-to-br from-white to-[#f8f8f8] p-4 md:p-6 text-center hover:border-[#9b59b6] transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-3xl md:text-5xl font-mono font-bold mb-2 tracking-tight">{data.healthStats.caloriesBurned}</div>
          <div className="text-[10px] md:text-xs font-mono text-[#555] uppercase tracking-[0.2em]">cal not burned</div>
        </div>
        <div className="border-[3px] border-black bg-gradient-to-br from-white to-[#f8f8f8] p-4 md:p-6 text-center hover:border-[#27ae60] transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-3xl md:text-5xl font-mono font-bold mb-2 tracking-tight">{data.healthStats.waymoTimeMinutes}</div>
          <div className="text-[10px] md:text-xs font-mono text-[#555] uppercase tracking-[0.2em]">min saved</div>
        </div>
      </section>
    </div>
  );
}
