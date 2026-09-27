import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/claude';
import { placesPrompt, timePrompt, cleanLines } from '@/lib/prompts';
import { FALLBACK_DESCRIPTIONS, fallbackTimeComparisons } from '@/lib/fallbacks';

function fallbackResponse(count: number, walkTimeMinutes = 15) {
  return NextResponse.json({
    descriptions: Array.from({ length: count }, (_, i) => FALLBACK_DESCRIPTIONS[i % FALLBACK_DESCRIPTIONS.length]),
    timeComparisons: fallbackTimeComparisons(walkTimeMinutes).map((text) => ({ text })),
  });
}

export async function POST(request: NextRequest) {
  let placeCount = 7;
  let walkTimeMinutes = 15;
  try {
    const body = await request.json();
    // Only accept what the page sends: up to 7 short place names and a sane walk time
    const places = (Array.isArray(body.places) ? body.places : []).slice(0, 7).map((p: any) => ({
      name: String(p?.name ?? '').slice(0, 80),
      type: String(p?.type ?? '').slice(0, 20),
    }));
    walkTimeMinutes = Math.min(Math.max(Math.round(Number(body.walkTimeMinutes) || 0), 1), 1000);
    placeCount = places.length;

    if (!process.env.ANTHROPIC_API_KEY || places.length === 0) {
      return fallbackResponse(placeCount, walkTimeMinutes);
    }

    // Generate POI descriptions
    const poiPrompt = placesPrompt(places);
    const timeComparisonPrompt = timePrompt(walkTimeMinutes);

    // Fire both Claude calls in parallel
    const [poiResponse, timeResponse] = await Promise.all([
      generateText(poiPrompt),
      generateText(timeComparisonPrompt),
    ]);

    const descriptions = cleanLines(poiResponse);

    // Shuffle so the one shown first isn't always the same kind of joke
    const timeComparisons = cleanLines(timeResponse)
      .sort(() => Math.random() - 0.5)
      .map((text) => ({ text }));

    return NextResponse.json({
      descriptions: Array.from({ length: placeCount }, (_, i) => descriptions[i] || FALLBACK_DESCRIPTIONS[i % FALLBACK_DESCRIPTIONS.length]),
      timeComparisons: timeComparisons.length ? timeComparisons : fallbackTimeComparisons(walkTimeMinutes).map((text) => ({ text })),
    });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    return fallbackResponse(placeCount, walkTimeMinutes);
  }
}
