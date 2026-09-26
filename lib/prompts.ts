// Instructions for Claude. Shared by /api/analyze and /api/generate-descriptions.

export function placesPrompt(places: { name: string; type: string }[]): string {
  return `You are writing one-line descriptions of San Francisco places someone missed by taking a robotaxi instead of walking. Precise, quietly elevated language. You are stating what is there: what you would see, hear, smell or feel walking past. Not trying to be funny or clever.

Occasionally use slightly old-fashioned or formal phrasing, because it fits, not as a gimmick.

Places:
${places.map((p, i) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

Rules:
- 12 words or fewer. Count them. One fragment or sentence.
- all lowercase, no full stop at the end, no quotation marks.
- Only state things that are well known and true about the place. Never invent numbers (floors, years, counts), history, menu items or claims. If you are unsure about a place, describe what is generally true of that kind of place instead.
- Be respectful. Memorials, plazas named for people, and cultural or community spaces are described with care, never dismissively.

Examples:
- where the painted victorians glow amber in the late afternoon light
- a winding mosaic staircase tucked between quiet gardens
- the ruins where the sea reclaims what was built
- an alley given over entirely to colour and declaration
- where the sourdough has been rising since before you were born
- a bar so dimly lit you forget what century it is

Return ONLY the descriptions, one per line, numbered to match.`;
}

export function timePrompt(walkTimeMinutes: number): string {
  const length = walkTimeMinutes > 120
    ? `This is a long walk (${Math.round(walkTimeMinutes / 60)} hours). Everything you compare it to should take less time than the walk.`
    : 'The thing you compare it to should take roughly that long. A little exaggeration is fine, nothing absurd.';

  return `Write 5 dry, deadpan time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

${length}

Each one is a gentle personal callout about how the reader spends time: "you've spent longer ___". Second person only ("you", "your"), never "I" or "my".

Make the 5 genuinely different. Mix everyday life with a little SF/tech life, so anyone gets it:
- phones and scrolling, group chats, streaming, podcasts, waiting in lines
- deciding what to eat, getting ready, commuting, errands, emails
- at most ONE tech-work reference (meetings, slack, waiting for something to load)

Avoid:
- repeating the same idea (no more than one about deploys, builds or code)
- anything about exercise, fitness, bodies or weight, or that makes walking sound like a chore. This site encourages walking.
- dating, relationships, drinking.

Tone: flat, observational, kind. The humor comes from the truth of it.

Examples of the vibe:
- you scrolled longer than this before getting out of bed
- that's about how long you spent picking a show and then not watching it
- you've waited longer in line for a pastry
- shorter than the group chat debate about where to eat

All lowercase. Return ONLY the 5 comparisons, one per line.`;
}

// Tidy model output: strip numbering, bullets, quotes, trailing full stops
export function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(\d+\.|-|•)\s*/, '').trim())
    .map((line) => line.replace(/^["']|["']$/g, '').replace(/\.$/, '').toLowerCase())
    .filter((line) => line.length > 0);
}
