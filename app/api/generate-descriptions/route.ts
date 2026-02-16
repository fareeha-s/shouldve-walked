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
    const poiPrompt = `You are generating deadpan, funny one-liners for SF landmarks and hidden gems someone missed by taking a waymo. The tone is dry and sarcastic. Not trying too hard. Just stating what they missed.

Places:
${places.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

Generate one short, punchy description for each place. MAXIMUM 12 words. Just one sentence. Deadpan. The humor comes from what they actually missed, not from punchlines.

Examples:
- iconic victorian houses with the best sunset view
- SF's most instagrammed street you rode past
- a hidden beach with views you'll never see
- murals that took artists weeks to paint
- stairs with a view worth the climb
- ancient cypress trees you'll never walk under
- blooming jacarandas lining the whole street

For parks and natural features, mention the actual trees, flowers, greenery, or wildlife when relevant. SF has incredible urban nature — eucalyptus groves, cypress trees, succulents, hummingbirds, red-tailed hawks. Make people feel what they missed.

Focus on what's actually special or beautiful about each place. Keep it real and simple.

IMPORTANT: Do NOT use quotation marks. Return ONLY the descriptions, one per line, numbered to match the places list.`;

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
      .map((text) => ({ text: text.trim() }));

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
