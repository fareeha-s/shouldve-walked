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

Each one is a personal callout about how the reader spends time. Second person only ("you", "your"), never "I" or "my".

The audience is SF tech twitter: people who've shipped real products, read papers, have opinions on infra. The tone is smart tech twitter. Dry, sarcastic, not trying hard. Not YC references. Not junior.

Make the 5 genuinely different from each other. Mostly tech/work life (CI, deploys, code review, slack, standups, infra, evals, tabs open), with one or two about SF life (lines for pastries, apartment hunting, waiting on a robotaxi). No more than one about deploys or builds.

Avoid:
- anything about exercise, fitness, bodies or weight, or that makes walking sound like a chore. This site encourages walking.
- dating, relationships, drinking.

Examples of the vibe:
- you've spent longer waiting for CI to pass
- you scrolled twitter longer than this before getting out of bed
- shorter than your average debugging session
- that's how long you spent choosing a font for your landing page
- you've waited longer in line at tartine

Don't try to be funny. Just state the comparison as a fact. Deadpan. Flat. The humor comes from the truth of it.
Don't explain or set up the joke, and don't wink at it. Specific nouns beat generic ones ("waiting for evals to finish" beats "waiting for work stuff"). No emojis, no exclamation marks, no "lol".

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
