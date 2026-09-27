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
  const timing = walkTimeMinutes <= 5
    ? `This is extremely short. Compare it only to things that plausibly take 1–5 minutes. Do not mention meetings, apartment hunting, debugging sessions or other long activities.
Good examples for this duration:
- you've waited longer for the elevator
- about one careful slack reply
- shorter than the coffee line downstairs`
    : walkTimeMinutes <= 15
      ? `Compare it to ordinary things that plausibly take 5–15 minutes.
Good examples for this duration:
- shorter than the line for coffee
- about one small code review
- you've waited longer for a robotaxi`
      : walkTimeMinutes <= 40
        ? `Compare it to things that plausibly take 15–40 minutes.
Good examples for this duration:
- shorter than a standup that ran over
- about one careful code review
- you've waited longer for a table in the mission`
        : walkTimeMinutes <= 120
          ? `Compare it to things that plausibly take about an hour or two.
Good examples for this duration:
- shorter than getting across the city at rush hour
- about one debugging session that was meant to be quick
- you've spent longer deciding what to eat and eating it`
          : `This is a long walk (${Math.round(walkTimeMinutes / 60)} hours). Everything you compare it to must clearly take less time than the walk.`;

  return `Write 5 dry, deadpan time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

${timing}

Each one is a personal callout about how the reader spends time. Second person only ("you", "your"), never "I" or "my".

The audience is people who build things in San Francisco. They know deploys, code review, Slack and the city's small rituals. Let that context sit in the background; do not perform a caricature of a tech person.

Make the 5 genuinely different. Use at most 2 tech/work references. The others should come from ordinary phone use, errands, coffee, transit or recognizable SF life. Use at most one niche technical noun in any line.

Avoid:
- anything about exercise, fitness, bodies or weight, or that makes walking sound like a chore. This site encourages walking.
- dating, relationships, drinking.
- invented personal history ("last weekend", "your last launch") or claims that assume a strangely specific event happened to the reader.
- jargon stacks, startup stereotypes, named AI tools, model evals, founders, VCs, YC, "shipping", "critical path" and jokes about not shipping.
- elaborate setups. One observation per line.
- distracted or unsafe behaviour, including using a phone while driving.

Don't try to be funny. Just state the comparison as a fact. Deadpan. Flat. The humor comes from the truth of it.
Every comparison must be believable for a ${walkTimeMinutes} minute duration. If the timing feels wrong, rewrite it.
Maximum 11 words per line. Use one clause. Never add a second beat with "plus", "minus", "and then", "where" or an explanation after a comma.
Don't explain or set up the joke, and don't wink at it. No emojis, no exclamation marks, no "lol".

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

export function cleanTimeLines(text: string, fallbacks: string[]): string[] {
  const generated = cleanLines(text)
    .filter((line) => line.split(/\s+/).length <= 11)
    .filter((line) => !/\b(plus|minus|and then|where)\b/.test(line));

  return [...generated, ...fallbacks.filter((line) => !generated.includes(line))].slice(0, 5);
}
