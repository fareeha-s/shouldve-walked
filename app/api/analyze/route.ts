import { NextRequest, NextResponse } from 'next/server';
import type { AnalysisResult, PointOfInterest } from '@/lib/types';
import { checkRateLimit } from '@/lib/ratelimit';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Bay Area bounding box
const BAY_AREA_BOUNDS = {
  north: 38.2,    // North of Sonoma
  south: 36.9,    // South of Santa Cruz
  west: -123.0,   // West coast
  east: -121.2,   // East of Livermore
};

// SF sketchy areas for safety warnings
const SKETCHY_AREAS = [
  {
    name: 'tenderloin',
    bounds: { north: 37.7877, south: 37.7805, west: -122.4181, east: -122.4089 },
    warnings: {
      day: "so you would've walked through the tenderloin. your waymo driver gets it",
      night: "yeah no this part you were absolutely right to drive"
    }
  },
  {
    name: 'mid-market',
    bounds: { north: 37.7840, south: 37.7800, west: -122.4140, east: -122.4080 },
    warnings: {
      day: "mid-market during the day. character building",
      night: "mid-market at night. sometimes waymo is the answer"
    }
  },
  {
    name: 'soma (6th st)',
    bounds: { north: 37.7820, south: 37.7750, west: -122.4100, east: -122.4050 },
    warnings: {
      day: "6th street. you would've had some stories",
      night: "6th street after dark. your waymo fare was worth every penny"
    }
  },
];

function isInBayArea(lat: number, lng: number): boolean {
  return (
    lat >= BAY_AREA_BOUNDS.south &&
    lat <= BAY_AREA_BOUNDS.north &&
    lng >= BAY_AREA_BOUNDS.west &&
    lng <= BAY_AREA_BOUNDS.east
  );
}

async function getDirections(pickup: string, dropoff: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    pickup
  )}&destination=${encodeURIComponent(
    dropoff
  )}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.routes[0]) {
    // Provide more helpful error messages
    if (data.status === 'ZERO_RESULTS') {
      throw new Error('those aren\'t real places (try "dolores park" or "ferry building")');
    } else if (data.status === 'NOT_FOUND') {
      throw new Error('couldn\'t find those addresses. try actual sf locations');
    } else {
      throw new Error('waymo doesn\'t go there either');
    }
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  // Check if route is in Bay Area
  const startLat = leg.start_location.lat;
  const startLng = leg.start_location.lng;
  const endLat = leg.end_location.lat;
  const endLng = leg.end_location.lng;

  if (!isInBayArea(startLat, startLng) || !isInBayArea(endLat, endLng)) {
    throw new Error('this only works in the bay area');
  }

  return {
    distance: leg.distance.value,
    duration: leg.duration.value,
    polyline: route.overview_polyline.points,
    bounds: route.bounds,
    steps: leg.steps,
  };
}

async function getNeighborhoodsAlongRoute(steps: any[]) {
  const neighborhoods = new Set<string>();

  // Sample points along the route (every 5th step to avoid too many API calls)
  const sampleSteps = steps.filter((_, i) => i % 5 === 0);

  for (const step of sampleSteps) {
    const location = step.start_location;
    const lat = location.lat;
    const lng = location.lng;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results[0]) {
      for (const component of data.results[0].address_components) {
        if (component.types.includes('neighborhood') || component.types.includes('sublocality')) {
          neighborhoods.add(component.long_name);
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return Array.from(neighborhoods);
}

// SF-specific landmarks and hidden gems that are worth calling out
const SF_LANDMARKS = [
  // Famous landmarks
  { name: 'Painted Ladies', lat: 37.7762, lng: -122.4330, type: 'viewpoint' as const, radius: 0.003 },
  { name: 'Coit Tower', lat: 37.8024, lng: -122.4058, type: 'viewpoint' as const, radius: 0.003 },
  { name: 'Palace of Fine Arts', lat: 37.8026, lng: -122.4486, type: 'art' as const, radius: 0.004 },
  { name: 'Lombard Street', lat: 37.8021, lng: -122.4187, type: 'viewpoint' as const, radius: 0.002 },

  // Parks and nature
  { name: 'Dolores Park', lat: 37.7596, lng: -122.4269, type: 'park' as const, radius: 0.005 },
  { name: 'Golden Gate Park', lat: 37.7694, lng: -122.4862, type: 'park' as const, radius: 0.01 },
  { name: 'Lands End Trail', lat: 37.7859, lng: -122.5089, type: 'nature' as const, radius: 0.004 },
  { name: 'Bernal Heights Hill', lat: 37.7416, lng: -122.4163, type: 'viewpoint' as const, radius: 0.003 },
  { name: 'Tank Hill', lat: 37.7537, lng: -122.4481, type: 'viewpoint' as const, radius: 0.002 },
  { name: 'Fort Funston', lat: 37.7133, lng: -122.5025, type: 'nature' as const, radius: 0.005 },

  // Hidden gems from Atlas Obscura
  { name: 'Wave Organ', lat: 37.8071, lng: -122.4359, type: 'art' as const, radius: 0.002 },
  { name: 'Seward Street Slides', lat: 37.7488, lng: -122.4409, type: 'park' as const, radius: 0.002 },
  { name: 'Sutro Baths ruins', lat: 37.7808, lng: -122.5144, type: 'nature' as const, radius: 0.003 },
  { name: 'Musée Mécanique', lat: 37.8099, lng: -122.5095, type: 'art' as const, radius: 0.001 },
  { name: 'Lands End Labyrinth', lat: 37.7851, lng: -122.5111, type: 'art' as const, radius: 0.001 },
  { name: 'Andy Goldsworthy Wood Line', lat: 37.7987, lng: -122.4698, type: 'art' as const, radius: 0.002 },

  // Mosaic steps and murals
  { name: '16th Avenue Tiled Steps', lat: 37.7551, lng: -122.4734, type: 'art' as const, radius: 0.002 },
  { name: 'Hidden Garden Steps', lat: 37.7565, lng: -122.4743, type: 'art' as const, radius: 0.002 },
  { name: 'Moraga Street stairs', lat: 37.7557, lng: -122.4737, type: 'art' as const, radius: 0.002 },
  { name: 'Clarion Alley murals', lat: 37.7551, lng: -122.4176, type: 'mural' as const, radius: 0.002 },
  { name: 'Balmy Alley murals', lat: 37.7479, lng: -122.4110, type: 'mural' as const, radius: 0.002 },
  { name: 'Lyon Street Steps', lat: 37.7969, lng: -122.4478, type: 'viewpoint' as const, radius: 0.002 },

  // Other hidden spots
  { name: 'Wild parrots of Telegraph Hill', lat: 37.8020, lng: -122.4057, type: 'nature' as const, radius: 0.003 },
  { name: 'Alemany Flea Market', lat: 37.7184, lng: -122.4133, type: 'viewpoint' as const, radius: 0.002 },
];

// Chain stores to filter out
const CHAIN_KEYWORDS = [
  'mcdonald', 'starbucks', 'subway', 'burger king', 'taco bell',
  'wendys', 'chipotle', 'panda express', 'cvs', 'walgreens', '7-eleven',
  'safeway', 'whole foods', 'trader joe', 'target', 'walmart'
];

function isChain(placeName: string): boolean {
  const lower = placeName.toLowerCase();
  return CHAIN_KEYWORDS.some(keyword => lower.includes(keyword));
}

async function getPlacesAlongRoute(steps: any[], startLat: number, startLng: number, endLat: number, endLng: number) {
  const places: PointOfInterest[] = [];
  const seenPlaces = new Set<string>();

  // Helper to check if a point is too close to start or end (within ~200m)
  const isTooCloseToStartOrEnd = (lat: number, lng: number) => {
    const startDist = Math.sqrt(Math.pow(lat - startLat, 2) + Math.pow(lng - startLng, 2));
    const endDist = Math.sqrt(Math.pow(lat - endLat, 2) + Math.pow(lng - endLng, 2));
    const threshold = 0.005; // ~500 meters
    return startDist < threshold || endDist < threshold;
  };

  // Check for SF landmarks along the route
  for (const step of steps) {
    const lat = step.start_location.lat;
    const lng = step.start_location.lng;

    for (const landmark of SF_LANDMARKS) {
      const distance = Math.sqrt(
        Math.pow(lat - landmark.lat, 2) + Math.pow(lng - landmark.lng, 2)
      );

      // Only add if it's along the route AND not at start/end points
      if (distance < landmark.radius &&
          !seenPlaces.has(landmark.name) &&
          !isTooCloseToStartOrEnd(landmark.lat, landmark.lng)) {
        seenPlaces.add(landmark.name);
        places.push({
          name: landmark.name,
          description: '', // Will be filled by LLM
          type: landmark.type,
          location: { lat: landmark.lat, lng: landmark.lng },
        });
      }
    }
  }

  // If we found fewer than 3 landmarks, look for interesting local places (not chains)
  if (places.length < 3) {
    const sampleSteps = steps.filter((_, i) => i % 4 === 0).slice(0, 3);

    for (const step of sampleSteps) {
      if (places.length >= 5) break; // Max 5 total

      const lat = step.start_location.lat;
      const lng = step.start_location.lng;

      // Search for parks, murals, viewpoints
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=150&type=park|point_of_interest&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        for (const place of data.results.slice(0, 2)) {
          if (places.length >= 5) break;

          const placeLat = place.geometry.location.lat;
          const placeLng = place.geometry.location.lng;

          // Skip chains, already seen places, and places too close to start/end
          if (isChain(place.name) ||
              seenPlaces.has(place.place_id) ||
              isTooCloseToStartOrEnd(placeLat, placeLng)) continue;

          seenPlaces.add(place.place_id);

          let type: PointOfInterest['type'] = 'park';
          if (place.types.includes('park')) type = 'park';
          else if (place.types.includes('art_gallery')) type = 'art';
          else if (place.types.includes('museum')) type = 'art';
          else type = 'viewpoint';

          places.push({
            name: place.name,
            description: '',
            type,
            location: {
              lat: placeLat,
              lng: placeLng,
            },
          });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Limit to 5 places max
  return places.slice(0, 5);
}

function calculateHealthStats(distance: number, duration: number) {
  const walkTimeMinutes = Math.round(duration / 60);
  const waymoTimeMinutes = Math.max(3, Math.round(walkTimeMinutes * 0.4)); // Assume Waymo is ~40% of walk time, min 3 min

  // Average: 2000 steps per mile, distance is in meters
  const miles = distance / 1609.34;
  const steps = Math.round(miles * 2000);

  // Average: 100 calories per mile walking
  const caloriesBurned = Math.round(miles * 100);

  // Exercise equivalents
  const exerciseEquivalents = [
    { name: '1 Barry\'s class', minutes: 50 },
    { name: '45 min cycling', minutes: 45 },
    { name: '30 min peloton ride', minutes: 30 },
    { name: '1 SoulCycle class', minutes: 45 },
    { name: '20 min HIIT workout', minutes: 20 },
    { name: '40 min yoga flow', minutes: 40 },
  ];

  const matchingExercise = exerciseEquivalents.find(
    (e) => Math.abs(e.minutes - walkTimeMinutes) < 10
  );
  const exerciseEquivalent = matchingExercise
    ? matchingExercise.name
    : `a ${walkTimeMinutes}-minute treadmill session`;

  const exerciseMinutes = walkTimeMinutes;
  const exercisePercentage = Math.min(100, Math.round((exerciseMinutes / 30) * 100));

  return {
    walkTimeMinutes,
    waymoTimeMinutes,
    steps,
    caloriesBurned,
    exerciseEquivalent,
    exerciseMinutes,
    exercisePercentage,
  };
}

async function getWeather(lat: number, lng: number) {
  try {
    // Using Open-Meteo API (free, no key required)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const response = await fetch(url);
    const data = await response.json();

    const weatherCode = data.current.weather_code;
    const temp = Math.round(data.current.temperature_2m);

    // Map weather codes to conditions
    let condition = 'clear';
    if (weatherCode >= 51 && weatherCode <= 67) condition = 'rainy';
    else if (weatherCode >= 71 && weatherCode <= 77) condition = 'snowy';
    else if (weatherCode >= 80 && weatherCode <= 99) condition = 'stormy';
    else if (weatherCode >= 1 && weatherCode <= 3) condition = 'cloudy';

    return { condition, temperature: temp };
  } catch (error) {
    return { condition: 'unknown', temperature: 60 };
  }
}

function checkSafetyWarnings(steps: any[]) {
  const warnings = [];
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 21;

  for (const step of steps) {
    const lat = step.start_location.lat;
    const lng = step.start_location.lng;

    for (const area of SKETCHY_AREAS) {
      if (
        lat >= area.bounds.south &&
        lat <= area.bounds.north &&
        lng >= area.bounds.west &&
        lng <= area.bounds.east
      ) {
        warnings.push({
          area: area.name,
          warning: isNight ? area.warnings.night : area.warnings.day,
        });
        break;
      }
    }
  }

  // Deduplicate warnings
  return warnings.filter(
    (w, i, arr) => arr.findIndex((w2) => w2.area === w.area) === i
  );
}

function calculateVerdict(
  safetyWarnings: any[],
  weather: { condition: string; temperature: number },
  walkTimeMinutes: number,
  hasParks: boolean,
  distance: number
) {
  // Edge case: Extremely short walks (< 2 minutes)
  if (walkTimeMinutes < 2) {
    const distanceFeet = Math.round(distance * 3.28084);
    return {
      worthIt: false,
      reason: `${distanceFeet} feet by car... that's honestly just lazy 🤍`,
    };
  }

  // Edge case: Very short walks (< 5 minutes)
  if (walkTimeMinutes < 5) {
    return {
      worthIt: false,
      reason: `${walkTimeMinutes} minute walk... your delivery driver walks further than this ☹️`,
    };
  }

  // Edge case: Absurdly long walks (over 2 hours)
  if (walkTimeMinutes > 120) {
    return {
      worthIt: true,
      reason: `${Math.round(walkTimeMinutes / 60)} hours of walking... that's a day hike. waymo was smart 💀`,
    };
  }

  // Edge case: Very long walks (over 90 minutes)
  if (walkTimeMinutes > 90) {
    return {
      worthIt: true,
      reason: 'this would\'ve been more exercise than most people get in a week... 😭',
    };
  }

  // Edge case: Multiple sketchy areas (crime scene tour)
  if (safetyWarnings.length > 2) {
    return {
      worthIt: true,
      reason: 'that route goes through multiple sketchy areas... waymo saved you 💀',
    };
  }

  // If there are safety warnings, ALWAYS say waymo was worth it
  if (safetyWarnings.length > 0) {
    const areas = safetyWarnings.map(w => w.area).join(' and ');
    return {
      worthIt: true,
      reason: `walking through ${areas}? waymo was the right move`,
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
      reason: `${weather.temperature}° sunshine through a park... yeah you should feel a little guilty 🥀`,
    };
  }

  // Edge case: Extreme heat + long walk
  if (weather.temperature > 90 && walkTimeMinutes > 20) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° for that long? nah... waymo was self-care`,
    };
  }

  // Edge case: Extreme cold + long walk
  if (weather.temperature < 40 && walkTimeMinutes > 20) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is too cold to be walking around that long...`,
    };
  }

  // If it's raining and no parks, not worth it
  if (weather.condition === 'rainy' && !hasParks) {
    return {
      worthIt: true,
      reason: 'rain + no nice views... waymo was totally justified 😔',
    };
  }

  // If it's rainy but there are parks
  if (weather.condition === 'rainy' && hasParks) {
    return {
      worthIt: false,
      reason: 'rainy park walks hit different... you missed that fresh smell 😭',
    };
  }

  // If it's very hot or very cold
  if (weather.temperature > 85) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is too hot to be out there voluntarily... 😔`,
    };
  }
  if (weather.temperature < 45) {
    return {
      worthIt: true,
      reason: `${weather.temperature}° is perfectly reasonable waymo weather ☹️`,
    };
  }

  // If walk is very short, should've walked
  if (walkTimeMinutes < 12) {
    return {
      worthIt: false,
      reason: 'honestly this was barely a walk... you know you should\'ve 🤍',
    };
  }

  // If walk is very long, waymo was reasonable
  if (walkTimeMinutes > 35) {
    return {
      worthIt: true,
      reason: 'that\'s a long walk... your legs thank you for the waymo 😔',
    };
  }

  // Default: borderline but probably should've walked
  return {
    worthIt: false,
    reason: 'perfect walking weather... safe streets.... no excuses really... 🥀',
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limits
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const rateLimitResult = checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.error || 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { pickup, dropoff } = await request.json();

    if (!pickup || !dropoff) {
      return NextResponse.json({ error: 'Missing pickup or dropoff' }, { status: 400 });
    }

    // Get directions
    const directions = await getDirections(pickup, dropoff);

    // Get weather
    const midLat = (directions.steps[0].start_location.lat + directions.steps[directions.steps.length - 1].end_location.lat) / 2;
    const midLng = (directions.steps[0].start_location.lng + directions.steps[directions.steps.length - 1].end_location.lng) / 2;
    const weather = await getWeather(midLat, midLng);

    // Get neighborhoods along route
    const neighborhoods = await getNeighborhoodsAlongRoute(directions.steps);

    // Get start and end locations for filtering POIs
    const startLat = directions.steps[0].start_location.lat;
    const startLng = directions.steps[0].start_location.lng;
    const endLat = directions.steps[directions.steps.length - 1].end_location.lat;
    const endLng = directions.steps[directions.steps.length - 1].end_location.lng;

    // Get places along route (excluding start/end points)
    const places = await getPlacesAlongRoute(directions.steps, startLat, startLng, endLat, endLng);

    // Generate descriptions for places using LLM
    const response = await fetch(`${request.nextUrl.origin}/api/generate-descriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places, walkTimeMinutes: Math.round(directions.duration / 60) }),
    });

    const { descriptions, timeComparisons } = await response.json();

    // Add descriptions to places
    const pointsOfInterest = places.map((place, i) => ({
      ...place,
      description: descriptions[i] || 'a place you walked past',
    }));

    // Calculate health stats
    const healthStats = calculateHealthStats(directions.distance, directions.duration);

    // Check safety warnings
    const safetyWarnings = checkSafetyWarnings(directions.steps);

    // Check if route has parks
    const hasParks = pointsOfInterest.some(poi => poi.type === 'park');

    // Calculate verdict
    const verdict = calculateVerdict(safetyWarnings, weather, healthStats.walkTimeMinutes, hasParks, directions.distance);

    const result: AnalysisResult = {
      route: {
        distance: directions.distance,
        duration: directions.duration,
        polyline: directions.polyline,
        bounds: {
          north: directions.bounds.northeast.lat,
          south: directions.bounds.southwest.lat,
          east: directions.bounds.northeast.lng,
          west: directions.bounds.southwest.lng,
        },
      },
      verdict,
      weather,
      neighborhoods,
      pointsOfInterest,
      healthStats,
      timeComparisons,
      safetyWarnings,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing route:', error);

    // Pass through specific error messages
    if (error instanceof Error && error.message) {
      // Check if it's one of our custom error messages
      if (error.message.includes('aren\'t real places') ||
          error.message.includes('couldn\'t find') ||
          error.message.includes('waymo doesn\'t go there') ||
          error.message.includes('only works in the bay area')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'something went wrong. try again?' },
      { status: 500 }
    );
  }
}
