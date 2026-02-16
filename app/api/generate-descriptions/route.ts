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
    const poiPrompt = `You are writing very short, slightly unhinged descriptions of SF places someone missed by taking a robotaxi. The tone is deadpan, specific, and a little weird. Like someone who knows way too much about this place and is slightly haunted by it. Not flowery. Not poetic. More like a friend who says something so specific it becomes accidentally profound.

Places:
${places.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

MAXIMUM 10 words per description. One fragment. Lowercase. No periods unless it is funny.

Examples of the exact vibe:
- the concrete slides that have destroyed thousands of pants
- where someone left a labyrinth and nobody asked why
- the parrots live here now. they won.
- smells like 1967 and incense and poor decisions
- genuinely just a yoda statue in the woods
- a piano that plays itself when the tide comes in
- sourdough older than most startups in this city
- they put furniture on the outside of the building. on purpose.
- the steps everyone photographs and nobody actually climbs
- where the fog eats the bridge and you just watch

Be SPECIFIC to each place. Reference actual details about it — what it looks like, what happens there, what is weird about it. For cafes/restaurants, mention the actual thing they are known for. For parks, mention what you actually see or do there. For bars, mention the vibe inside.

NEVER be generic. NEVER say "hidden gem" or "tucked away" or "nestled" or "charming." If the description could apply to any place, rewrite it.

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
