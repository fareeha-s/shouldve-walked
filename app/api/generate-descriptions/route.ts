import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { places, walkTimeMinutes } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = getOpenAIClient();

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

    const poiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: poiPrompt }],
      temperature: 0.9,
    });

    const descriptionsText = poiResponse.choices[0].message.content || '';
    const descriptions = descriptionsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .map((line) => line.replace(/^["']|["']$/g, '')); // Remove leading/trailing quotes

    // Generate time comparisons
    let timePrompt = '';

    // Edge case: Very long walks (over 2 hours)
    if (walkTimeMinutes > 120) {
      timePrompt = `Generate 5 time comparisons for a ${walkTimeMinutes} minute (${Math.round(walkTimeMinutes / 60)} hour) walk someone skipped by taking a robotaxi.

CRITICAL: Each comparison MUST be something that actually takes roughly ${walkTimeMinutes} minutes or less. The walk is LONGER than these things. Be accurate about how long things take.

Tone: dry, deadpan tech/SF life observations. Not trying to be funny. Just stating facts.

Examples of ACCURATE comparisons:
- for 150 min: "that's longer than most movies you've watched this year"
- for 180 min: "you could have finished a full technical interview loop"
- for 200 min: "that's an entire cross-country flight's worth of walking"

DO NOT exaggerate or make up durations. If you're not sure how long something takes, don't use it.

Return ONLY the comparisons, one per line.`;
    } else {
      // Normal walks
      timePrompt = `Generate 5 time comparisons for a ${walkTimeMinutes} minute walk someone skipped by taking a robotaxi in San Francisco.

CRITICAL: Each comparison MUST be something that genuinely takes about ${walkTimeMinutes} minutes (give or take a few minutes). Be accurate. Do not exaggerate.

Real-world reference points:
- 5 min: making a cup of coffee, checking your email
- 10 min: a short standup meeting, walking to the corner store
- 15 min: a coffee break, one pomodoro break
- 20 min: a short podcast episode, waiting for food delivery
- 25 min: one pomodoro work session, a quick gym warmup
- 30 min: a lunch break, one episode of a sitcom
- 40 min: a long meeting, a spin class
- 45 min: a yoga class, a therapy session
- 60 min: a proper workout, one episode of prestige TV

Tone: dry, deadpan tech/SF life observations. Smart but not trying hard. Think people who ship products and have opinions on infra.

AVOID: Dating/relationship jokes, romance references. Stick to tech/work/SF life.

DO NOT say something takes ${walkTimeMinutes} minutes if it actually takes way more or way less. Accuracy matters.

Return ONLY the comparisons, one per line.`;
    }

    const timeResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: timePrompt }],
      temperature: 0.9,
    });

    const timeComparisonsText = timeResponse.choices[0].message.content || '';
    const timeComparisons = timeComparisonsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => line.length > 0)
      .map((text) => ({ text }));

    return NextResponse.json({
      descriptions,
      timeComparisons,
    });
  } catch (error) {
    console.error('Error generating descriptions:', error);
    return NextResponse.json(
      { error: 'Failed to generate descriptions' },
      { status: 500 }
    );
  }
}
