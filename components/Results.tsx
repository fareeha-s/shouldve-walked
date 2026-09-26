'use client';

import type { AnalysisResult } from '@/lib/types';
import { hoursLabel } from '@/lib/formatTime';
import RouteMap from './RouteMap';

interface ResultsProps {
  data: AnalysisResult;
}

function typeBorderColor(type: string) {
  switch (type) {
    case 'viewpoint': return '#c0813d';
    case 'park': return '#4a8c5c';
    case 'nature': return '#5a9e6f';
    case 'coffee': return '#8b6b4a';
    case 'bar': return '#7a5082';
    case 'art': return '#4a7a9e';
    case 'mural': return '#9e5a6f';
    case 'restaurant': return '#b5634b';
    default: return 'var(--th-border)';
  }
}

function TypeIcon({ type }: { type: string }) {
  const size = 14;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (type) {
    case 'viewpoint':
      return <svg {...common}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/></svg>;
    case 'park':
      return <svg {...common}><path d="M12 22V13"/><path d="M7 13l5-8 5 8H7z"/><path d="M9 9l3-5 3 5"/></svg>;
    case 'nature':
      return <svg {...common}><path d="M6 21c3-3 7-4 12-9C13 7 9 6 6 3c-1 6-1 12 0 18z"/><path d="M6 21c3-5 6-8 12-9"/></svg>;
    case 'coffee':
      return <svg {...common}><path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>;
    case 'bar':
      return <svg {...common}><line x1="12" y1="14" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/><path d="M4 2h16l-6 12H10L4 2z"/></svg>;
    case 'art':
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/></svg>;
    case 'mural':
      return <svg {...common}><path d="M18.37 2.63a2.12 2.12 0 013 3L14 13l-4 1 1-4 7.37-7.37z"/><path d="M3 17v4h4l-1-2-3-2z"/></svg>;
    case 'restaurant':
      return <svg {...common}><line x1="8" y1="2" x2="8" y2="22"/><path d="M4 2v6c0 2 2 4 4 4"/><path d="M12 2v6c0 2-2 4-4 4"/><path d="M18 2l-2 10h4L18 2z"/><line x1="18" y1="12" x2="18" y2="22"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="4"/></svg>;
  }
}

export default function Results({ data }: ResultsProps) {
  const timeSaved = data.healthStats.walkTimeMinutes - data.healthStats.waymoTimeMinutes;

  return (
    <div className="mt-12 md:mt-20 space-y-8 md:space-y-16 animate-in fade-in duration-500">

      {/* Safety Warnings - Show first if exists */}
      {data.safetyWarnings.length > 0 && (
        <section
          className="p-6 md:p-10"
          style={{
            border: '3px solid var(--th-error)',
            backgroundColor: 'var(--th-error-bg)',
            boxShadow: 'var(--th-shadow-lg)',
          }}
        >
          <h2 className="text-base md:text-lg font-mono font-semibold mb-4 md:mb-6 uppercase tracking-[0.2em]" style={{ color: 'var(--th-error)' }}>safety note for this route</h2>
          <div className="space-y-3">
            {data.safetyWarnings
              .filter((w, i, all) => all.findIndex((x) => x.warning === w.warning) === i)
              .map((warning, index) => (
              <div
                key={index}
                className="text-sm md:text-base font-mono leading-relaxed"
                style={{ color: 'var(--th-text-sec)' }}
              >
                {warning.warning}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Map with walk time overlay */}
      <section className="relative">
        <h2 className="text-xs font-mono uppercase tracking-[0.25em] mb-5" style={{ color: 'var(--th-text-label)' }}>the route</h2>
        <div className="relative">
          <RouteMap data={data} />
          <div
            className="absolute bottom-4 right-4 px-4 py-3"
            style={{
              backgroundColor: 'var(--th-surface)',
              border: '3px solid var(--th-border)',
              boxShadow: 'var(--th-shadow-sm)',
            }}
          >
            <div className="text-2xl md:text-3xl font-mono font-bold tracking-tight leading-none" style={{ color: 'var(--th-text)' }}>
              {data.healthStats.walkTimeMinutes < 60 ? data.healthStats.walkTimeMinutes : hoursLabel(data.healthStats.walkTimeMinutes)}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--th-text-label)' }}>
              {data.healthStats.walkTimeMinutes < 60 ? 'min walk' : `walk · ${data.healthStats.walkTimeMinutes} min`}
            </div>
          </div>
        </div>
        {data.googleMapsUrl && (
          <a
            href={data.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs md:text-sm font-mono underline"
            style={{ color: 'var(--th-text-sec)' }}
          >
            open this walk in google maps ↗
          </a>
        )}
        {data.timeComparisons.length > 0 && data.timeComparisons[0].text && (
          <div className="mt-3 text-xs md:text-sm font-mono text-right" style={{ color: 'var(--th-text-label)' }}>
            {data.timeComparisons[0].text}
          </div>
        )}
      </section>

      {/* Points of Interest */}
      {data.pointsOfInterest.length > 0 ? (
        <section>
          <h2 className="text-xs font-mono uppercase tracking-[0.25em] mb-6" style={{ color: 'var(--th-text-label)' }}>what you missed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {data.pointsOfInterest.map((poi, index) => (
              <div
                key={index}
                className="p-4 md:p-5 transition-all flex flex-col hover:translate-x-[-2px] hover:translate-y-[-2px]"
                style={{
                  border: `3px solid ${typeBorderColor(poi.type)}`,
                  backgroundColor: 'var(--th-surface)',
                  boxShadow: 'var(--th-shadow-sm)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--th-shadow-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--th-shadow-sm)'; }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold leading-tight" style={{ color: 'var(--th-text-sec)' }}>
                    <span className="flex-shrink-0" style={{ color: typeBorderColor(poi.type) }}><TypeIcon type={poi.type} /></span>
                    {poi.name}
                  </div>
                  {poi.type !== 'nature' && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name + " San Francisco")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-8 h-8 md:w-6 md:h-6 flex items-center justify-center text-xs md:text-[10px] transition-colors"
                      title="view on map"
                      aria-label={`View ${poi.name} on Google Maps`}
                      style={{
                        border: '2px solid var(--th-border)',
                        backgroundColor: 'var(--th-surface)',
                        color: 'var(--th-text)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--th-link-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--th-surface)'; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
                <div className="text-sm font-serif italic leading-relaxed mt-1" style={{ color: 'var(--th-text-muted)' }}>{poi.description || <span className="animate-pulse">…</span>}</div>
              </div>
            ))}

            {/* Exercise equivalent card */}
            <div
              className="p-4 md:p-5 flex flex-col justify-center"
              style={{
                border: '3px solid var(--th-border)',
                backgroundColor: 'var(--th-surface-warm)',
                boxShadow: 'var(--th-shadow-sm)',
              }}
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--th-text-faint)' }}>
                exercise skipped
              </div>
              <div className="text-sm md:text-base font-mono leading-relaxed" style={{ color: 'var(--th-text-sec)' }}>
                the equivalent of {data.healthStats.exerciseEquivalent} — {data.healthStats.caloriesBurned} cal
              </div>
              <div className="text-xs font-mono mt-2" style={{ color: 'var(--th-text-muted)' }}>
                +{data.healthStats.hrvBoost}ms hrv boost you skipped
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="text-center py-10"
          style={{
            border: '3px dashed var(--th-text-faint)',
            backgroundColor: 'var(--th-surface-alt)',
          }}
        >
          <div className="text-sm font-mono" style={{ color: 'var(--th-text-label)' }}>
            you missed: nothing. just beige buildings and parked cars
          </div>
        </section>
      )}

      {/* Neighborhoods */}
      {data.neighborhoods.length > 0 && (
        <section>
          <h2 className="text-xs font-mono uppercase tracking-[0.25em] mb-5" style={{ color: 'var(--th-text-label)' }}>neighborhoods</h2>
          <div className="grid grid-cols-2 md:flex md:justify-center gap-2 md:gap-3">
            {data.neighborhoods.map((neighborhood, index) => (
              <div
                key={index}
                className="px-3 md:px-4 py-2 md:py-2.5 font-mono text-xs md:text-sm font-semibold transition-all text-center"
                style={{
                  border: '3px solid var(--th-border)',
                  backgroundColor: 'var(--th-surface)',
                  color: 'var(--th-text)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--th-link-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--th-surface)'; }}
              >
                {neighborhood}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key stats at bottom */}
      <section className="grid grid-cols-2 gap-3 md:gap-4">
        <div
          className="p-4 md:p-6 text-center transition-colors"
          style={{
            border: '3px solid var(--th-border)',
            backgroundColor: 'var(--th-surface)',
            boxShadow: 'var(--th-shadow-lg)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--th-stat-hover-1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--th-border)'; }}
        >
          <div className="text-3xl md:text-5xl font-mono font-bold mb-2 tracking-tight" style={{ color: 'var(--th-text)' }}>{data.healthStats.steps.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--th-text-muted)' }}>steps missed</div>
        </div>
        <div
          className="p-4 md:p-6 text-center transition-colors"
          style={{
            border: '3px solid var(--th-border)',
            backgroundColor: 'var(--th-surface)',
            boxShadow: 'var(--th-shadow-lg)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--th-stat-hover-3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--th-border)'; }}
        >
          <div className="text-3xl md:text-5xl font-mono font-bold mb-2 tracking-tight" style={{ color: 'var(--th-text)' }}>{timeSaved < 60 ? <>{timeSaved}<span className="text-lg md:text-2xl"> min</span></> : <>{hoursLabel(timeSaved)}<span className="text-lg md:text-2xl"> ({timeSaved} min)</span></>}</div>
          <div className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--th-text-muted)' }}>saved by car</div>
        </div>
      </section>
    </div>
  );
}
