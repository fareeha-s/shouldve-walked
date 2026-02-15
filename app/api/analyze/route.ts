import { NextRequest, NextResponse } from 'next/server';
import type { AnalysisResult, PointOfInterest } from '@/lib/types';
import { checkRateLimit } from '@/lib/ratelimit';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// SF sketchy areas for safety warnings
const SKETCHY_AREAS = [
  { name: 'tenderloin', bounds: { north: 37.7877, south: 37.7805, west: -122.4181, east: -122.4089 } },
  { name: 'mid-market', bounds: { north: 37.7840, south: 37.7800, west: -122.4140, east: -122.4080 } },
  { name: 'soma (6th st)', bounds: { north: 37.7820, south: 37.7750, west: -122.4100, east: -122.4050 } },
];

async function getDirections(pickup: string, dropoff: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
    pickup + ', San Francisco, CA'
  )}&destination=${encodeURIComponent(
    dropoff + ', San Francisco, CA'
  )}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.routes[0]) {
    throw new Error('Could not get directions');
  }

  const route = data.routes[0];
  const leg = route.legs[0];

  return {
    distance: leg.distance.value,
    duration: leg.duration.value,
    polyline: route.overview_polyline.points,
    bounds: route.bounds,
    steps: leg.steps,
  };
}

async function getPlacesAlongRoute(steps: any[]) {
  const places: PointOfInterest[] = [];
  const seenPlaces = new Set<string>();

  // Sample points along the route (every 3rd step to avoid too many API calls)
  const sampleSteps = steps.filter((_, i) => i % 3 === 0);

  for (const step of sampleSteps) {
    const location = step.start_location;
    const lat = location.lat;
    const lng = location.lng;

    // Search for places near this point
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&type=cafe|restaurant|bar|park&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.results) {
      for (const place of data.results.slice(0, 2)) {
        if (!seenPlaces.has(place.place_id)) {
          seenPlaces.add(place.place_id);

          let type: PointOfInterest['type'] = 'coffee';
          if (place.types.includes('cafe') || place.types.includes('coffee')) type = 'coffee';
          else if (place.types.includes('restaurant')) type = 'restaurant';
          else if (place.types.includes('bar')) type = 'bar';
          else if (place.types.includes('park')) type = 'park';

          places.push({
            name: place.name,
            description: '', // Will be filled by LLM
            type,
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
            },
          });
        }
      }
    }

    // Add a small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return places;
}

function calculateHealthStats(distance: number, duration: number) {
  const walkTimeMinutes = Math.round(duration / 60);
  const waymoTimeMinutes = Math.max(3, Math.round(walkTimeMinutes * 0.4)); // Assume Waymo is ~40% of walk time, min 3 min

  // Average: 2000 steps per mile, distance is in meters
  const miles = distance / 1609.34;
  const steps = Math.round(miles * 2000);

  // Average: 100 calories per mile walking
  const caloriesBurned = Math.round(miles * 100);

  // Food equivalents
  const foodEquivalents = [
    { name: 'a blue bottle oat latte', calories: 150 },
    { name: 'half a tartine croissant', calories: 200 },
    { name: 'a dandelion chocolate bar', calories: 220 },
    { name: 'a bi-rite ice cream sandwich', calories: 250 },
    { name: 'a flour + water pizza slice', calories: 280 },
    { name: 'an arsicault croissant', calories: 350 },
  ];

  const matchingFood = foodEquivalents.find(
    (f) => Math.abs(f.calories - caloriesBurned) < 50
  );
  const foodEquivalent = matchingFood
    ? matchingFood.name
    : `${(caloriesBurned / 150).toFixed(1)} lattes`;

  const exerciseMinutes = walkTimeMinutes;
  const exercisePercentage = Math.min(100, Math.round((exerciseMinutes / 30) * 100));

  // Guilt score: higher for shorter distances
  let guiltScore = 10;
  if (walkTimeMinutes > 30) guiltScore = 3;
  else if (walkTimeMinutes > 20) guiltScore = 5;
  else if (walkTimeMinutes > 15) guiltScore = 7;
  else if (walkTimeMinutes > 10) guiltScore = 9;

  return {
    walkTimeMinutes,
    waymoTimeMinutes,
    steps,
    caloriesBurned,
    foodEquivalent,
    exerciseMinutes,
    exercisePercentage,
    guiltScore,
  };
}

function checkSafetyWarnings(steps: any[]) {
  const warnings = [];

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
        const hour = new Date().getHours();
        const isNight = hour < 6 || hour > 21;

        if (isNight) {
          warnings.push({
            area: area.name,
            warning: "yeah no this part you were right to drive",
          });
        } else {
          warnings.push({
            area: area.name,
            warning: "keep your wits about you on this stretch",
          });
        }
        break;
      }
    }
  }

  // Deduplicate warnings
  return warnings.filter(
    (w, i, arr) => arr.findIndex((w2) => w2.area === w.area) === i
  );
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

    // Get places along route
    const places = await getPlacesAlongRoute(directions.steps);

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
      pointsOfInterest,
      healthStats,
      timeComparisons,
      safetyWarnings,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing route:', error);
    return NextResponse.json(
      { error: 'Failed to analyze route' },
      { status: 500 }
    );
  }
}
