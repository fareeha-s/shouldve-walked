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
    const poiPrompt = `You are writing warm, wistful one-line descriptions of SF places someone missed by taking a robotaxi instead of walking. The tone is tender but oddly specific. Like someone who loves this city so much they notice strange details nobody else does. Beautiful but with one foot in the absurd.

Places:
${places.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

MAXIMUM 12 words. One sentence or fragment. Lowercase. Evocative but slightly strange.

Examples of the exact vibe:
- where the painted victorians catch light like they know you are watching
- a labyrinth someone built on a cliff and then just... left
- the parrots own this hill now and they are not subtle about it
- a staircase made of broken dishes and someone's whole heart
- the ruins where the ocean is slowly winning
- sourdough that has been alive longer than your lease
- a bar so dark your eyes need a full minute to adjust
- where the fog rolls in and the bridge just disappears mid-sentence
- the kind of park where strangers share a sunset without talking
- a bookshop that smells like dust and ambition and 1953

Be SPECIFIC to each place. Reference what actually makes it singular — a texture, a smell, a light, a weird fact. For cafes, what you would actually taste or feel sitting there. For parks, the specific view or the specific silence. For bars, the exact quality of the darkness.

NEVER use: hidden gem, tucked away, nestled, charming, vibrant, bustling, quaint, iconic. These words are dead. If the description could apply to any city, rewrite it until it could only be San Francisco.

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
      timePrompt = `You are generating absurdly honest time comparisons for a ${walkTimeMinutes} minute (${Math.round(walkTimeMinutes / 60)} hour) walk that someone skipped by taking a robotaxi.

This is an insane distance to walk. The comparisons should highlight how long this is. The walk is LONGER than these things. Dry. Sarcastic. Just stating facts.

Examples for ${walkTimeMinutes} minutes:
- that's longer than your entire CI/CD pipeline
- you've had shorter oncalls
- that's a full deploy cycle including rollback

IMPORTANT: The ${walkTimeMinutes} minute walk should be LONGER than what you're comparing it to. Don't say "you've spent less time" - that makes no sense.

Generate 5 different comparisons. Return ONLY the comparisons, one per line.`;
    } else {
      // Normal walks
      timePrompt = `You are generating dry, sarcastic time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

The tone is smart tech twitter. Dry. Sarcastic. Not trying hard. Just stating observations. Think people who've shipped real products, read papers, have opinions on infra. Not YC references. Not junior.

AVOID: Dating jokes, relationship references, romance, going out references. Stick to tech/work/SF life only.

Examples of the vibe:
- you've spent longer waiting for CI to pass
- that's one loom video nobody will watch
- you've spent longer in the stripe dashboard today
- shorter than your average debugging session
- that's how long you spent choosing a font for your landing page
- you've scrolled twitter longer than this in the bathroom

Don't try to be funny. Just state the comparison as a fact. Deadpan. Flat. The humor comes from the truth of it.

Generate 5 different comparisons for a ${walkTimeMinutes} minute walk. Return ONLY the comparisons, one per line.`;
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
