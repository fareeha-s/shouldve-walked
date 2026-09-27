// Pre-written lines used when the AI is unavailable (e.g. spend limit reached)
export const FALLBACK_DESCRIPTIONS = [
  'you would have walked right past it. you did not.',
  'it was there the whole time.',
  'smells better in person.',
  'people who walked here seemed fine.',
  'the window seats looked good from the car.',
  'someone locally famous probably works here.',
];
export function fallbackTimeComparisons(walkTimeMinutes: number): string[] {
  if (walkTimeMinutes <= 5) {
    return [
      "you've waited longer for an elevator",
      'about one careful slack reaction',
      'shorter than a coffee pickup',
      "you've spent longer finding the right tab",
      'roughly one reread of the same error message',
    ];
  }

  if (walkTimeMinutes <= 15) {
    return [
      'shorter than the line for coffee',
      'about one small code review',
      "you've waited longer for a robotaxi",
      'roughly one unnecessary slack thread',
      "you've spent longer choosing where to get lunch",
    ];
  }

  if (walkTimeMinutes <= 40) {
    return [
      'shorter than a standup that ran over',
      'about one careful code review',
      "you've waited longer for a table in the mission",
      'roughly the time lost to a calendar gap',
      "you've spent longer getting across town",
    ];
  }

  if (walkTimeMinutes <= 120) {
    return [
      "you've spent longer in a planning meeting",
      'shorter than getting across the city at rush hour',
      'about one debugging session that was meant to be quick',
      'roughly the time between ordering dinner and eating it',
      "you've left browser tabs open longer than this",
    ];
  }

  return [
    'you could have watched a film and still had time left',
    'longer than any meeting should be allowed to last',
    "you've crossed the bay and come back in less time",
    'longer than the deploy you were told would take ten minutes',
    'enough time to reconsider the starting point entirely',
  ];
}
