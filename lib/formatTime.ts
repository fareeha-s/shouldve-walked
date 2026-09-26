const QUARTERS = ['', '¼', '½', '¾'];

// 91 -> "1½ hours", rounded to the nearest quarter hour
export function hoursLabel(minutes: number): string {
  const quarters = Math.round(minutes / 15);
  const whole = Math.floor(quarters / 4);
  const text = `${whole || ''}${QUARTERS[quarters % 4]}` || '0';
  return `${text} ${quarters === 4 ? 'hour' : 'hours'}`;
}

// Under an hour stays in minutes; longer reads like "1½ hours (91 min)"
export function formatDuration(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${hoursLabel(minutes)} (${minutes} min)`;
}
