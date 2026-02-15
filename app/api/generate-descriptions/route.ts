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
    const poiPrompt = `You are generating deadpan, slightly funny one-liners for places someone walked past in San Francisco. The tone is internet humor that doesn't try too hard. Not corporate funny. Not wellness app friendly. Just sounds like someone who's chronically online describing what you walked past.

Places:
${places.map((p: any, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

Generate one deadpan description for each place. Each description should be a single sentence. Don't try to be funny. Just state something as a fact. The humor comes from the truth of it, not from punchlines.

Examples of the vibe:
- "a coffee shop where the barista would've remembered your order but ok"
- "a mural of a giant hummingbird you'll never emotionally connect with now"
- "a park bench with arguably the best view of the sunset but sure, sit in traffic"
- "a magnolia tree that was blooming for you specifically and you didn't even look"

Return ONLY the descriptions, one per line, numbered to match the places list.`;

    const poiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: poiPrompt }],
      temperature: 0.9,
    });

    const descriptionsText = poiResponse.choices[0].message.content || '';
    const descriptions = descriptionsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim());

    // Generate time comparisons
    const timePrompt = `You are generating hyper-specific time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

The comparisons should be hyper-specific to SF startup and AI lab culture. Not big tech corporate, not fresh grads. Think 22-32 year old builders who moved to SF, live in a hacker house or overpriced soma apartment, post on twitter too much, and are building their second or third thing.

Examples of the vibe:
- "you spent longer than this choosing between supabase and planetscale"
- "that's how long you spent on your personal site nobody visits"
- "shorter than your last coffee chat that was definitely a pitch"
- "you doom scrolled longer than this before bed last night"
- "that's one 'quick sync' with your cofounder"
- "you've spent longer refreshing hacker news today"

Don't try to be funny. Just state the comparison as a fact. The humor comes from the truth of it, not from punchlines or clever wording. Deadpan. Flat. Just say it.

Generate 5 different comparisons for a ${walkTimeMinutes} minute walk. Return ONLY the comparisons, one per line.`;

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
