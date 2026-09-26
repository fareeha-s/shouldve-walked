import { hoursLabel } from '@/lib/formatTime';

// "45 minutes", or "1½ hours" once it's an hour or more
const duration = (minutes: number) => (minutes < 60 ? `${minutes} minutes` : hoursLabel(minutes));

// Hand-written verdict rules (no AI): decides "should you have walked?"
export function calculateVerdict(
  safetyWarnings: any[],
  weather: { condition: string; temperature: number },
  walkTimeMinutes: number,
  hasParks: boolean,
  distance: number,
  neighborhoods: string[],
  poiNames: string[]
) {
  // Pick ride brand based on neighborhood
  const isMission = neighborhoods.some(n => n.toLowerCase().includes('mission'));
  const ride = (isMission && Math.random() < 0.25) ? 'zoox' : (Math.random() > 0.5 ? 'waymo' : 'robotaxi');

  // Edge case: Extremely short walks (< 2 minutes)
  if (walkTimeMinutes < 2) {
    const distanceFeet = Math.round(distance * 3.28084);
    return {
      worthIt: false,
      reason: `${distanceFeet} feet by ${ride}... that's honestly just lazy 🙃`,
    };
  }

  // Edge case: Very short walks (< 5 minutes)
  if (walkTimeMinutes < 5) {
    return {
      worthIt: false,
      reason: `${walkTimeMinutes} minute walk... your delivery driver walks further than this ☹️`,
    };
  }

  // SAFETY FIRST - ALWAYS check dangerous areas before anything else
  // Edge case: Multiple sketchy areas (crime scene tour)
  if (safetyWarnings.length > 2) {
    return {
      worthIt: true,
      reason: `yeah no... the ${ride} earned its fare on this one 💀`,
    };
  }

  // If there are ANY safety warnings, ALWAYS say waymo was worth it
  if (safetyWarnings.length > 0) {
    return {
      worthIt: true,
      reason: `nah you were right to call the ${ride} on this one 🫡`,
    };
  }

  // Over 2 hours: the ride is fair, but keep the door open to walking
  if (walkTimeMinutes > 120) {
    return {
      worthIt: true,
      reason: `${hoursLabel(walkTimeMinutes)} on foot is a proper adventure... the ${ride} was fair this time. maybe walk part of it next time 🤍`,
    };
  }

  // 1-2 hours is a very walkable SF afternoon when the weather's decent
  if (walkTimeMinutes >= 60 && weather.condition !== 'stormy' && weather.condition !== 'rainy' && weather.temperature > 50 && weather.temperature < 85) {
    if (hasParks && weather.condition === 'clear') {
      return {
        worthIt: false,
        reason: `${hoursLabel(walkTimeMinutes)} through parks in ${weather.temperature}° weather... that's a great afternoon you skipped 🤍`,
      };
    }
    return {
      worthIt: false,
      reason: `${hoursLabel(walkTimeMinutes)} is a real walk... and a good one. that's the whole point 🚶`,
    };
  }

  // Edge case: Perfect guilt trip (clear weather, short walk, safe, has parks)
  if (
    weather.condition === 'clear' &&
    walkTimeMinutes < 15 &&
    weather.temperature > 60 &&
    weather.temperature < 75 &&
    hasParks
  ) {
    return {
      worthIt: false,
      reason: `${weather.temperature}° and clear skies through a park... yeah you should feel a little guilty 😔`,
    };
  }

  // Edge case: Extreme heat + long walk
  if (weather.temperature > 90 && walkTimeMinutes > 20) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° for that long? nah... ${ride} was self-care`,
    };
  }

  // Edge case: Extreme cold + long walk
  if (weather.temperature < 40 && walkTimeMinutes > 20) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is too cold to be walking around that long...`,
    };
  }

  // Fog: classic SF, great for walking actually
  if (weather.condition === 'foggy') {
    if (walkTimeMinutes < 20) {
      return {
        worthIt: false,
        reason: 'a little karl the fog never hurt anyone... should\'ve walked 🌫️',
      };
    }
    return {
      worthIt: false,
      reason: `${duration(walkTimeMinutes)} in the fog... that\'s peak SF walking weather 🌫️`,
    };
  }

  // Rain: most people don't want to walk in the rain
  if (weather.condition === 'rainy' || weather.condition === 'stormy') {
    if (weather.condition === 'stormy') {
      return {
        worthIt: true,
        reason: `stormy out there... ${ride} was the right call today`,
      };
    }
    if (walkTimeMinutes > 30) {
      return {
        worthIt: true,
        reason: `${duration(walkTimeMinutes)} in the rain? nah... ${ride} was fair`,
      };
    }
    if (walkTimeMinutes > 15) {
      return {
        worthIt: true,
        reason: `rain + ${duration(walkTimeMinutes)}... you made the right call`,
      };
    }
    return {
      worthIt: false,
      reason: `it was raining but... ${duration(walkTimeMinutes)}? grab an umbrella and go 🌧️`,
    };
  }

  // If it's very hot or very cold
  if (weather.temperature > 85) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is too hot to be out there voluntarily... 🥵`,
    };
  }
  if (weather.temperature < 45) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is perfectly reasonable ${ride} weather 🥶`,
    };
  }

  // If walk is very short, should've walked
  if (walkTimeMinutes < 12) {
    return {
      worthIt: false,
      reason: 'honestly this was barely a walk... you know you should\'ve 🤍',
    };
  }

  // Long walks with truly bad conditions already handled above
  if (walkTimeMinutes > 45 && !hasParks) {
    return {
      worthIt: true,
      reason: `${duration(walkTimeMinutes)} with nothing pretty to see... ${ride} was fair 😔`,
    };
  }

  // Default: should've walked, but phrase it based on actual weather
  if (weather.condition === 'clear' && weather.temperature >= 55) {
    return {
      worthIt: false,
      reason: 'perfect walking weather... safe streets... no excuses really... 💀',
    };
  }
  if (weather.condition === 'cloudy') {
    return {
      worthIt: false,
      reason: `a little overcast but ${weather.temperature}°... you would\'ve been fine 💀`,
    };
  }
  return {
    worthIt: false,
    reason: `${duration(walkTimeMinutes)}... you probably should\'ve walked 💀`,
  };
}
