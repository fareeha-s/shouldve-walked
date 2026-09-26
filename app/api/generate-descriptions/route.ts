import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/claude';
import { FALLBACK_DESCRIPTIONS, FALLBACK_TIME_COMPARISONS } from '@/lib/fallbacks';

function fallbackResponse(count: number) {
  return NextResponse.json({
    descriptions: Array.from({ length: count }, (_, i) => FALLBACK_DESCRIPTIONS[i % FALLBACK_DESCRIPTIONS.length]),
    timeComparisons: FALLBACK_TIME_COMPARISONS.map((text) => ({ text })),
  });
}

export async function POST(request: NextRequest) {
  let placeCount = 7;
  try {
    const body = await request.json();
    // Only accept what the page sends: up to 7 short place names and a sane walk time
    const places = (Array.isArray(body.places) ? body.places : []).slice(0, 7).map((p: any) => ({
      name: String(p?.name ?? '').slice(0, 80),
      type: String(p?.type ?? '').slice(0, 20),
    }));
    const walkTimeMinutes = Math.min(Math.max(Math.round(Number(body.walkTimeMinutes) || 0), 1), 1000);
    placeCount = places.length;

    if (!process.env.ANTHROPIC_API_KEY || places.length === 0) {
      return fallbackResponse(placeCount);
    }

    // Generate POI descriptions
    const poiPrompt = `You are writing one-line descriptions of SF places someone missed by taking a robotaxi instead of walking. Factual but with elevated language. You know these places well and you are simply stating what is there. Not trying to be funny or clever. Just describing what you would see, hear, or feel if you walked past.

Occasionally use slightly old-fashioned or formal phrasing — not as a gimmick, just because it fits. Think: someone who reads a lot and it has seeped into how they talk.

Places:
${places.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

MAXIMUM 12 words. One sentence or fragment. Lowercase.

Examples:
- where the painted victorians glow amber in the late afternoon light
- a winding mosaic staircase tucked between quiet gardens
- the ruins where the sea reclaims what was built
- an alley given over entirely to colour and declaration
- the prospect from the summit that diminishes the whole city
- where the sourdough has been rising since before you were born
- a bar so dimly lit you forget what century it is
- the steps are tiled in broken china and someone's devotion

State what is actually there. A view, a smell, a material, a history. For cafes, say what they actually serve or what the room feels like. For parks, say what you see from them. For bars, say what it is like inside. For murals, say what is depicted or how the paint sits on the wall.

Do not try to be poetic. Just be precise and the rest follows.

IMPORTANT: Do NOT use quotation marks. Return ONLY the descriptions, one per line, numbered to match.`;

    // Build time comparison prompt before firing both GPT calls in parallel
    let timePrompt = '';

    // Edge case: Very long walks (over 2 hours)
    if (walkTimeMinutes > 120) {
      timePrompt = `Generate 5 time comparisons for a ${walkTimeMinutes} minute (${Math.round(walkTimeMinutes / 60)} hour) walk that someone skipped by taking a robotaxi.

This is an insane distance to walk. The comparisons should highlight how long this is. The walk is LONGER than these things. Dry. Sarcastic. Just stating facts.

Every comparison must be about something YOU (the person) have personally done or spent time on. NOT random facts about how long things take in the world. It should feel like a personal callout.

NEVER use first person ("I", "my"). Always use second person ("you", "your").

The comparison should be roughly accurate — the thing you're comparing to should actually take less than ${walkTimeMinutes} minutes.

Examples for long walks:
- that's longer than most movies you've sat through this year
- you've had shorter oncalls
- you've spent less time in the gym this entire week

Generate 5 different comparisons. Return ONLY the comparisons, one per line.`;
    } else {
      // Normal walks
      timePrompt = `Generate 5 dry, sarcastic time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

The tone is smart tech twitter. Dry. Sarcastic. Not trying hard. Just stating observations. Think people who've shipped real products, read papers, have opinions on infra. Not YC references. Not junior.

IMPORTANT: Every comparison must be about something YOU (the person) have personally done or could do. Things you've wasted time on, habits you have, actions you take. NOT random facts about how long other processes take in the world. It should feel like a personal callout.

NEVER use first person ("I", "my"). Always use second person ("you", "your").

The comparison should be roughly accurate — the thing you're comparing to should actually take around ${walkTimeMinutes} minutes, give or take. A little exaggeration is fine but it shouldn't be absurd.

AVOID: Dating jokes, relationship references, romance, going out references. Stick to tech/work/SF life only.

Examples of the vibe:
- you've spent longer waiting for CI to pass
- you scrolled twitter longer than this before getting out of bed
- shorter than your average debugging session
- that's how long you spent choosing a font for your landing page
- you've spent more time than this deciding where to eat

Don't try to be funny. Just state the comparison as a fact. Deadpan. Flat. The humor comes from the truth of it.

Generate 5 different comparisons for a ${walkTimeMinutes} minute walk. Return ONLY the comparisons, one per line.`;
    }

    // Fire both Claude calls in parallel
    const [poiResponse, timeResponse] = await Promise.all([
      generateText(poiPrompt),
      generateText(timePrompt),
    ]);

    const descriptionsText = poiResponse;
    const descriptions = descriptionsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .map((line) => line.replace(/^["']|["']$/g, '')); // Remove leading/trailing quotes

    const timeComparisonsText = timeResponse;
    const timeComparisons = timeComparisonsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => line.length > 0)
      .map((text) => ({ text }));

    return NextResponse.json({
      descriptions: Array.from({ length: placeCount }, (_, i) => descriptions[i] || FALLBACK_DESCRIPTIONS[i % FALLBACK_DESCRIPTIONS.length]),
      timeComparisons: timeComparisons.length ? timeComparisons : FALLBACK_TIME_COMPARISONS.map((text) => ({ text })),
    });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    return fallbackResponse(placeCount);
  }
}
