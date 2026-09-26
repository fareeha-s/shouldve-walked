import { NextRequest, NextResponse } from 'next/server';
import type { AnalysisResult, PointOfInterest } from '@/lib/types';
import { checkRateLimit } from '@/lib/ratelimit';
import { generateText } from '@/lib/claude';
import { calculateVerdict } from '@/lib/verdict';
import { FALLBACK_DESCRIPTIONS, FALLBACK_TIME_COMPARISONS } from '@/lib/fallbacks';

export const maxDuration = 30;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

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
    alwaysWarn: true, // sketchy any time of day
    warnings: {
      day: "stay aware of your surroundings on this part of the walk.",
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
  {
    name: 'mid-market',
    bounds: { north: 37.7840, south: 37.7800, west: -122.4140, east: -122.4080 },
    alwaysWarn: true,
    warnings: {
      day: "stay aware of your surroundings on this part of the walk.",
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
  {
    name: 'soma (6th st)',
    bounds: { north: 37.7820, south: 37.7750, west: -122.4100, east: -122.4050 },
    alwaysWarn: true,
    warnings: {
      day: "stay aware of your surroundings on this part of the walk.",
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
  {
    name: 'bayview',
    bounds: { north: 37.7350, south: 37.7100, west: -122.3950, east: -122.3700 },
    alwaysWarn: false, // only warn at night
    warnings: {
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
  {
    name: 'hunters point',
    bounds: { north: 37.7350, south: 37.7200, west: -122.3850, east: -122.3600 },
    alwaysWarn: false,
    warnings: {
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
  {
    name: 'western addition',
    bounds: { north: 37.7850, south: 37.7750, west: -122.4350, east: -122.4200 },
    alwaysWarn: false,
    warnings: {
      night: "this part of the walk is less safe at night. consider a ride instead."
    }
  },
];

const DAILY_LIMIT_MESSAGE =
  "too many people are finding out what they missed today. the map is resting. try again tomorrow, or just go for a walk.";

function isInBayArea(lat: number, lng: number): boolean {
  return (
    lat >= BAY_AREA_BOUNDS.south &&
    lat <= BAY_AREA_BOUNDS.north &&
    lng >= BAY_AREA_BOUNDS.west &&
    lng <= BAY_AREA_BOUNDS.east
  );
}

// Safest detours longer than this are offered, not forced
const MAX_AUTO_DETOUR_SECONDS = 15 * 60;

async function getDirections(pickup: string, dropoff: string, avoidUnsafe: boolean = false, capDetour: boolean = false) {
  let url: string;
  let rerouted = false;
  let quickestDuration: number | null = null;
  let normalData: any = null;
  let declinedDetourSeconds = 0;
  let viaPoints: Array<{ lat: number; lng: number }> = [];

  if (avoidUnsafe) {
    // First, get the normal route to see which sketchy areas it passes through
    const normalUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      pickup
    )}&destination=${encodeURIComponent(
      dropoff
    )}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;
    const normalResp = await fetch(normalUrl);
    normalData = await normalResp.json();

    // Find which sketchy areas the normal route passes through
    const areasToAvoid = new Set<string>();
    if (normalData.status === 'OK' && normalData.routes[0]) {
      quickestDuration = normalData.routes[0].legs[0].duration.value;
      const normalSteps = normalData.routes[0].legs[0].steps;
      for (const { lat, lng } of normalSteps.flatMap(stepPoints)) {
        for (const area of SKETCHY_AREAS) {
          if (lat >= area.bounds.south && lat <= area.bounds.north &&
              lng >= area.bounds.west && lng <= area.bounds.east) {
            areasToAvoid.add(area.name);
          }
        }
      }
    }

    // Build avoidance waypoints only for areas the route actually passes through
    const avoidancePoints: Array<{ lat: number; lng: number }> = [];
    const AVOIDANCE_MAP: Record<string, Array<{ lat: number; lng: number }>> = {
      'tenderloin': [{ lat: 37.7890, lng: -122.4080 }],      // North via Union Square
      'mid-market': [{ lat: 37.7770, lng: -122.4140 }],      // South of Market
      'soma (6th st)': [{ lat: 37.7810, lng: -122.3960 }],   // East via Embarcadero side
      'bayview': [{ lat: 37.7380, lng: -122.4000 }],          // West side
      'hunters point': [{ lat: 37.7380, lng: -122.3900 }],    // North/west
      'western addition': [{ lat: 37.7870, lng: -122.4250 }], // North via Japantown
    };

    for (const areaName of areasToAvoid) {
      const points = AVOIDANCE_MAP[areaName];
      if (points) avoidancePoints.push(...points);
    }

    if (avoidancePoints.length > 0) {
      rerouted = true;
      viaPoints = avoidancePoints;
      const waypointStr = avoidancePoints
        .map(wp => `via:${wp.lat},${wp.lng}`)
        .join('|');
      url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        pickup
      )}&destination=${encodeURIComponent(
        dropoff
      )}&mode=walking&waypoints=${encodeURIComponent(waypointStr)}&key=${GOOGLE_MAPS_API_KEY}`;
    } else {
      // No areas to avoid, just use normal route
      url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        pickup
      )}&destination=${encodeURIComponent(
        dropoff
      )}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;
    }
  } else {
    url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      pickup
    )}&destination=${encodeURIComponent(
      dropoff
    )}&mode=walking&key=${GOOGLE_MAPS_API_KEY}`;
  }

  const response = await fetch(url);
  let data = await response.json();

  // Detour too long: show the quickest route and let the user opt into the safer one
  if (capDetour && rerouted && quickestDuration !== null && data.status === 'OK' && data.routes[0]) {
    const detour = data.routes[0].legs[0].duration.value - quickestDuration;
    if (detour > MAX_AUTO_DETOUR_SECONDS) {
      declinedDetourSeconds = detour;
      data = normalData;
      rerouted = false;
      viaPoints = [];
    }
  }

  if (data.status !== 'OK' || !data.routes[0]) {
    // Provide more helpful error messages
    if (data.status === 'ZERO_RESULTS') {
      throw new Error('can\'t find a walking route between those — try more specific sf addresses');
    } else if (['OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT', 'REQUEST_DENIED'].includes(data.status)) {
      throw new Error(DAILY_LIMIT_MESSAGE);
    } else if (data.status === 'NOT_FOUND') {
      throw new Error('couldn\'t find one or both of those places — try something like "dolores park" or "ferry building"');
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

  // Check if route is roughly in SF (not San Jose, Oakland, etc.)
  const isSFish = (lat: number, lng: number) =>
    lat >= 37.70 && lat <= 37.82 && lng >= -122.52 && lng <= -122.35;
  if (!isSFish(startLat, startLng) && !isSFish(endLat, endLng)) {
    throw new Error('this works best in SF proper... try a route in the city');
  }

  return {
    distance: leg.distance.value,
    duration: leg.duration.value,
    polyline: route.overview_polyline.points,
    bounds: route.bounds,
    steps: leg.steps,
    rerouted,
    declinedDetourSeconds,
    viaPoints,
    extraSeconds: rerouted && quickestDuration !== null ? Math.max(0, leg.duration.value - quickestDuration) : 0,
  };
}

async function getNeighborhoodsAlongRoute(steps: any[]) {
  const neighborhoods = new Set<string>();

  // Sample points along the route (every 5th step to avoid too many API calls)
  const sampleSteps = steps.filter((_, i) => i % 5 === 0);

  // Fire all geocoding calls in parallel instead of sequentially
  const results = await Promise.all(
    sampleSteps.map(async (step) => {
      try {
        const { lat, lng } = step.start_location;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        return await response.json();
      } catch {
        return null;
      }
    })
  );

  for (const data of results) {
    if (data?.results?.[0]) {
      for (const component of data.results[0].address_components) {
        if (component.types.includes('neighborhood') || component.types.includes('sublocality')) {
          neighborhoods.add(component.long_name);
        }
      }
    }
  }

  return Array.from(neighborhoods);
}

// Permanent SF landmarks (things that literally cannot close - public art, parks, viewpoints, steps, buildings)
const SF_LANDMARKS = [
  // Famous landmarks
  { name: 'Painted Ladies', lat: 37.7762, lng: -122.4330, type: 'viewpoint' as const, radius: 0.003, priority: 1 },
  { name: 'Coit Tower', lat: 37.8024, lng: -122.4058, type: 'viewpoint' as const, radius: 0.003, priority: 1 },
  { name: 'Palace of Fine Arts', lat: 37.8026, lng: -122.4486, type: 'art' as const, radius: 0.004, priority: 1 },
  { name: 'Lombard Street', lat: 37.8021, lng: -122.4187, type: 'viewpoint' as const, radius: 0.002, priority: 1 },
  { name: 'Ferry Building', lat: 37.7955, lng: -122.3937, type: 'viewpoint' as const, radius: 0.003, priority: 1 },
  { name: 'Transamerica Pyramid', lat: 37.7952, lng: -122.4028, type: 'viewpoint' as const, radius: 0.002, priority: 1 },
  { name: 'City Lights Bookstore', lat: 37.7976, lng: -122.4064, type: 'art' as const, radius: 0.001, priority: 1 },
  { name: 'Grace Cathedral', lat: 37.7915, lng: -122.4131, type: 'art' as const, radius: 0.002, priority: 1 },

  // Parks and nature
  { name: 'Dolores Park', lat: 37.7596, lng: -122.4269, type: 'park' as const, radius: 0.005, priority: 1 },
  { name: 'Golden Gate Park', lat: 37.7694, lng: -122.4862, type: 'park' as const, radius: 0.01, priority: 1 },
  { name: 'Lands End Trail', lat: 37.7859, lng: -122.5089, type: 'nature' as const, radius: 0.004, priority: 1 },
  { name: 'Bernal Heights Hill', lat: 37.7416, lng: -122.4163, type: 'viewpoint' as const, radius: 0.003, priority: 1 },
  { name: 'Tank Hill', lat: 37.7537, lng: -122.4481, type: 'viewpoint' as const, radius: 0.002, priority: 1 },
  { name: 'Fort Funston', lat: 37.7133, lng: -122.5025, type: 'nature' as const, radius: 0.005, priority: 2 },
  { name: 'Glen Canyon Park', lat: 37.7394, lng: -122.4413, type: 'nature' as const, radius: 0.004, priority: 2 },
  { name: 'McLaren Park', lat: 37.7183, lng: -122.4213, type: 'park' as const, radius: 0.005, priority: 1 },
  { name: 'Buena Vista Park', lat: 37.7696, lng: -122.4413, type: 'park' as const, radius: 0.003, priority: 1 },
  { name: 'Corona Heights', lat: 37.7654, lng: -122.4387, type: 'viewpoint' as const, radius: 0.002, priority: 1 },
  { name: 'Twin Peaks', lat: 37.7544, lng: -122.4477, type: 'viewpoint' as const, radius: 0.003, priority: 1 },
  { name: 'Presidio', lat: 37.7989, lng: -122.4662, type: 'nature' as const, radius: 0.008, priority: 1 },
  { name: 'Baker Beach', lat: 37.7936, lng: -122.4836, type: 'nature' as const, radius: 0.003, priority: 1 },
  { name: 'Ocean Beach', lat: 37.7605, lng: -122.5105, type: 'nature' as const, radius: 0.005, priority: 1 },
  { name: 'Crissy Field', lat: 37.8039, lng: -122.4617, type: 'nature' as const, radius: 0.004, priority: 1 },

  // Hidden gems and Atlas Obscura spots (permanent installations)
  { name: 'Wave Organ', lat: 37.8071, lng: -122.4359, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Seward Street Slides', lat: 37.7488, lng: -122.4409, type: 'park' as const, radius: 0.002, priority: 2 },
  { name: 'Sutro Baths ruins', lat: 37.7808, lng: -122.5144, type: 'nature' as const, radius: 0.003, priority: 2 },
  { name: 'Lands End Labyrinth', lat: 37.7851, lng: -122.5111, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'Andy Goldsworthy Wood Line', lat: 37.7987, lng: -122.4698, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Cayuga Park tree sculptures', lat: 37.7183, lng: -122.4428, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Spire sculpture (Presidio)', lat: 37.7934, lng: -122.4571, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Camera Obscura', lat: 37.7785, lng: -122.5138, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'Yoda Fountain (Presidio)', lat: 37.7989, lng: -122.4526, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'San Francisco Columbarium', lat: 37.7741, lng: -122.4583, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'Rincon Center murals', lat: 37.7900, lng: -122.3914, type: 'mural' as const, radius: 0.001, priority: 2 },

  // Mosaic steps, murals, street art (permanent public art)
  { name: '16th Avenue Tiled Steps', lat: 37.7551, lng: -122.4734, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Hidden Garden Steps', lat: 37.7565, lng: -122.4743, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Moraga Street stairs', lat: 37.7557, lng: -122.4737, type: 'art' as const, radius: 0.002, priority: 2 },
  { name: 'Clarion Alley murals', lat: 37.7551, lng: -122.4176, type: 'mural' as const, radius: 0.002, priority: 2 },
  { name: 'Balmy Alley murals', lat: 37.7479, lng: -122.4110, type: 'mural' as const, radius: 0.002, priority: 2 },
  { name: 'Lyon Street Steps', lat: 37.7969, lng: -122.4478, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: 'Filbert Street Steps', lat: 37.8019, lng: -122.4043, type: 'nature' as const, radius: 0.002, priority: 2 },
  { name: 'Greenwich Steps', lat: 37.8027, lng: -122.4050, type: 'nature' as const, radius: 0.002, priority: 2 },
  { name: 'Vallejo Street Stairway', lat: 37.7994, lng: -122.4095, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: "Women\'s Building murals", lat: 37.7602, lng: -122.4213, type: 'mural' as const, radius: 0.001, priority: 2 },
  { name: 'Mission murals on 24th St', lat: 37.7521, lng: -122.4181, type: 'mural' as const, radius: 0.003, priority: 2 },

  // Gardens and green spaces
  { name: 'Japanese Tea Garden', lat: 37.7701, lng: -122.4701, type: 'nature' as const, radius: 0.002, priority: 3 },
  { name: 'Conservatory of Flowers', lat: 37.7726, lng: -122.4598, type: 'nature' as const, radius: 0.002, priority: 3 },
  { name: 'SF Botanical Garden', lat: 37.7671, lng: -122.4706, type: 'nature' as const, radius: 0.004, priority: 3 },
  { name: "Garden of Shakespeare\'s Flowers", lat: 37.7702, lng: -122.4692, type: 'nature' as const, radius: 0.001, priority: 3 },
  { name: 'Stern Grove', lat: 37.7368, lng: -122.4722, type: 'nature' as const, radius: 0.003, priority: 3 },

  // Stairways and views
  { name: 'Grandview Park', lat: 37.7553, lng: -122.4715, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: 'Ina Coolbrith Park', lat: 37.7969, lng: -122.4148, type: 'viewpoint' as const, radius: 0.001, priority: 2 },
  { name: 'Kite Hill', lat: 37.7553, lng: -122.4413, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: 'Billy Goat Hill', lat: 37.7432, lng: -122.4360, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: 'Mount Sutro Open Space', lat: 37.7593, lng: -122.4557, type: 'nature' as const, radius: 0.003, priority: 2 },

  // Historic and permanent quirky spots
  { name: 'Wild parrots of Telegraph Hill', lat: 37.8020, lng: -122.4057, type: 'nature' as const, radius: 0.003, priority: 2 },
  { name: 'Haight-Ashbury corner', lat: 37.7699, lng: -122.4469, type: 'viewpoint' as const, radius: 0.001, priority: 2 },
  { name: 'Jack Kerouac Alley', lat: 37.7976, lng: -122.4061, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'Pier 7 boardwalk', lat: 37.7980, lng: -122.3974, type: 'viewpoint' as const, radius: 0.002, priority: 2 },
  { name: 'Embarcadero waterfront', lat: 37.7955, lng: -122.3917, type: 'viewpoint' as const, radius: 0.003, priority: 2 },

  // Pocket parks and public spaces
  { name: "Patricia\'s Green", lat: 37.7757, lng: -122.4229, type: 'park' as const, radius: 0.001, priority: 2 },
  { name: 'South Park', lat: 37.7823, lng: -122.3942, type: 'park' as const, radius: 0.002, priority: 2 },
  { name: 'Michelangelo Playground', lat: 37.8005, lng: -122.4098, type: 'park' as const, radius: 0.001, priority: 2 },
  { name: 'Noe Valley Town Square', lat: 37.7513, lng: -122.4326, type: 'park' as const, radius: 0.001, priority: 2 },

  // Permanent street art and murals
  { name: 'Precita Eyes murals', lat: 37.7474, lng: -122.4109, type: 'mural' as const, radius: 0.002, priority: 2 },
  { name: 'Calle 24 Latino Cultural District', lat: 37.7521, lng: -122.4181, type: 'mural' as const, radius: 0.003, priority: 2 },
  { name: 'Diego Rivera mural at SFAI', lat: 37.8006, lng: -122.4058, type: 'art' as const, radius: 0.001, priority: 1 },
  { name: 'Defenestration building', lat: 37.7863, lng: -122.3963, type: 'art' as const, radius: 0.001, priority: 2 },
  { name: 'Sentinel Building (Coppola)', lat: 37.7975, lng: -122.4064, type: 'viewpoint' as const, radius: 0.001, priority: 2 },
  { name: 'Humanity mural at Beach & Taylor', lat: 37.8071, lng: -122.4163, type: 'mural' as const, radius: 0.001, priority: 2 },
];

// Chain stores and junk places to filter out
const CHAIN_KEYWORDS = [
  'mcdonald', 'starbucks', 'subway', 'burger king', 'taco bell',
  'wendys', 'chipotle', 'panda express', 'cvs', 'walgreens', '7-eleven',
  'safeway', 'whole foods', 'trader joe', 'target', 'walmart',
  'shell', 'chevron', 'arco', 'valero', 'bp ', '76 ',
  'bank of america', 'chase bank', 'wells fargo', 'citibank',
  'fedex', 'ups store', 'usps', 'post office',
  'rite aid', 'dollar tree', 'dollar general',
  'autozone', 'o\'reilly', 'jiffy lube',
];

// Google Places types that are never interesting
const JUNK_TYPES = [
  'parking', 'gas_station', 'car_wash', 'car_repair', 'car_dealer',
  'laundry', 'storage', 'insurance_agency', 'real_estate_agency',
  'dentist', 'doctor', 'hospital', 'pharmacy', 'veterinary_care',
  'bank', 'atm', 'accounting', 'lawyer',
  'locksmith', 'electrician', 'plumber', 'roofing_contractor',
  'moving_company', 'funeral_home', 'lodging', 'convenience_store',
  'liquor_store', 'supermarket', 'grocery_or_supermarket',
];

function isChain(placeName: string): boolean {
  const lower = placeName.toLowerCase();
  return CHAIN_KEYWORDS.some(keyword => lower.includes(keyword));
}

function isJunkPlace(place: any): boolean {
  // Filter by Google Places types
  if (place.types && place.types.some((t: string) => JUNK_TYPES.includes(t))) return true;

  // Filter by name patterns (parking lots, generic businesses)
  const lower = (place.name || '').toLowerCase();
  if (/parking|garage|\blot\b|storage|laundro|cleaners|nail salon|barber/i.test(lower)) return true;

  // Filter gibberish names (too short, mostly punctuation, random letters)
  const nameLetters = (place.name || '').replace(/[^a-zA-Z]/g, '');
  if (nameLetters.length < 3) return true;
  if (/^[A-Z\.\s,]{1,20}$/.test((place.name || '').trim())) return true;

  // ALL places need at least some reviews to be real
  if (!place.user_ratings_total || place.user_ratings_total < 5) return true;

  // Parks/museums get a lower bar but still need to be legit
  const isWellKnownType = place.types && (
    place.types.includes('park') ||
    place.types.includes('museum') ||
    place.types.includes('art_gallery') ||
    place.types.includes('tourist_attraction')
  );
  if (isWellKnownType) {
    if (!place.rating || place.rating < 3.5) return true;
    return false;
  }

  // Everything else needs strong reviews
  if (!place.rating || place.rating < 4.0) return true;
  if (!place.user_ratings_total || place.user_ratings_total < 50) return true;

  return false;
}


// Search Foursquare Places API for hidden gems (cafes, bars, bookstores, galleries)
async function searchFoursquare(lat: number, lng: number, seenNames: Set<string>): Promise<PointOfInterest[]> {
  if (!FOURSQUARE_API_KEY) return [];

  try {
    // Foursquare v3 category IDs for interesting places
    const categories = [
      '13032', // Cafe
      '13035', // Coffee Shop
      '13003', // Bar
      '13009', // Cocktail Bar
      '13065', // Restaurant
      '17069', // Bookstore
      '10032', // Art Gallery
      '10025', // Museum
      '17114', // Vintage / Thrift Store
      '10027', // Performing Arts Venue
    ].join(',');

    const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=400&categories=${categories}&limit=10&sort=RELEVANCE`;

    const response = await fetch(url, {
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.results || [])
      .filter((place: any) => {
        // Skip chains
        if (place.chains && place.chains.length > 0) return false;
        // Skip if already seen
        if (seenNames.has(place.name.toLowerCase())) return false;
        return true;
      })
      .slice(0, 5)
      .map((place: any) => {
        const catId = place.categories?.[0]?.id?.toString() || '';
        let type: PointOfInterest['type'] = 'viewpoint';
        if (catId === '13003' || catId === '13009') type = 'bar';
        else if (catId === '13032' || catId === '13035') type = 'coffee';
        else if (catId === '13065') type = 'restaurant';
        else if (catId === '17069' || catId === '10032' || catId === '10025' || catId === '10027') type = 'art';

        return {
          name: place.name,
          description: '',
          type,
          location: {
            lat: place.geocodes?.main?.latitude || lat,
            lng: place.geocodes?.main?.longitude || lng,
          },
        };
      });
  } catch (error) {
    console.error('Foursquare search error:', error);
    return [];
  }
}

// Search OpenStreetMap Overpass API for street art, murals, and sculptures
async function searchOverpass(lat: number, lng: number, seenNames: Set<string>): Promise<PointOfInterest[]> {
  try {
    const bbox = `${(lat - 0.004).toFixed(4)},${(lng - 0.005).toFixed(4)},${(lat + 0.004).toFixed(4)},${(lng + 0.005).toFixed(4)}`;
    const query = `[out:json][timeout:5];(node["tourism"="artwork"](${bbox});node["man_made"="mural"](${bbox});node["artwork_type"="mural"](${bbox});node["artwork_type"="sculpture"](${bbox}););out body;`;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.elements || [])
      .filter((el: any) => {
        if (!el.tags?.name) return false;
        if (seenNames.has(el.tags.name.toLowerCase())) return false;
        return true;
      })
      .slice(0, 5)
      .map((el: any) => ({
        name: el.tags.name,
        description: '',
        type: (el.tags.man_made === 'mural' || el.tags.artwork_type === 'mural') ? 'mural' as const : 'art' as const,
        location: { lat: el.lat, lng: el.lon },
      }));
  } catch (error) {
    console.error('Overpass search error:', error);
    return [];
  }
}

async function getPlacesAlongRoute(steps: any[], startLat: number, startLng: number, endLat: number, endLng: number) {
  const places: PointOfInterest[] = [];
  const seenPlaces = new Set<string>();

  // Helper to check if a point is too close to start or end (within ~200m)
  const isTooCloseToStartOrEnd = (lat: number, lng: number) => {
    const startDist = Math.sqrt(Math.pow(lat - startLat, 2) + Math.pow(lng - startLng, 2));
    const endDist = Math.sqrt(Math.pow(lat - endLat, 2) + Math.pow(lng - endLng, 2));
    const threshold = 0.003; // ~300 meters
    return startDist < threshold || endDist < threshold;
  };

  // --- SOURCE 1: Check permanent SF landmarks along the route ---
  const landmarkMatches: Array<PointOfInterest & { priority: number }> = [];

  for (const step of steps) {
    const lat = step.start_location.lat;
    const lng = step.start_location.lng;

    for (const landmark of SF_LANDMARKS) {
      const distance = Math.sqrt(
        Math.pow(lat - landmark.lat, 2) + Math.pow(lng - landmark.lng, 2)
      );

      if (distance < landmark.radius &&
          !seenPlaces.has(landmark.name.toLowerCase()) &&
          !isTooCloseToStartOrEnd(landmark.lat, landmark.lng)) {
        seenPlaces.add(landmark.name.toLowerCase());
        landmarkMatches.push({
          name: landmark.name,
          description: '',
          type: landmark.type,
          location: { lat: landmark.lat, lng: landmark.lng },
          priority: landmark.priority,
        });
      }
    }
  }

  // Sort by priority (famous first, then hidden gems, then nature)
  landmarkMatches.sort((a, b) => a.priority - b.priority);

  // Only include priority 3 (nature/gardens) if we have fewer than 3 from priorities 1-2
  const goodMatches = landmarkMatches.filter(m => m.priority <= 2);
  if (goodMatches.length >= 3) {
    places.push(...goodMatches);
  } else {
    places.push(...landmarkMatches);
  }

  // Sample points along route for API searches
  const totalSteps = steps.length;
  const sampleCount = Math.min(6, totalSteps);
  const sampleInterval = Math.max(1, Math.floor(totalSteps / sampleCount));
  const sampleSteps = steps.filter((_, i) => i % sampleInterval === 0).slice(0, 6);
  // Pick 2-3 representative points for Foursquare/Overpass (to save API calls)
  const fewSampleSteps = sampleSteps.filter((_, i) => i % 2 === 0).slice(0, 3);

  // --- SOURCE 2: Google Places (with business_status filtering) ---
  if (places.length < 7) {
    const interestingTypes = [
      'park|art_gallery|museum|tourist_attraction',
      'cafe|book_store|bar|bakery',
    ];

    for (const typeQuery of interestingTypes) {
      if (places.length >= 7) break;

      for (const step of sampleSteps) {
        if (places.length >= 7) break;

        const lat = step.start_location.lat;
        const lng = step.start_location.lng;

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=350&type=${typeQuery}&key=${GOOGLE_MAPS_API_KEY}`;

        let data: any;
        try {
          const response = await fetch(url);
          data = await response.json();
        } catch {
          continue;
        }

        if (data?.results) {
          for (const place of data.results.slice(0, 5)) {
            if (places.length >= 7) break;

            // Skip permanently closed places
            if (place.business_status && place.business_status !== 'OPERATIONAL') continue;

            const placeLat = place.geometry.location.lat;
            const placeLng = place.geometry.location.lng;

            if (isChain(place.name) ||
                isJunkPlace(place) ||
                seenPlaces.has(place.place_id) ||
                seenPlaces.has(place.name.toLowerCase()) ||
                isTooCloseToStartOrEnd(placeLat, placeLng)) continue;

            seenPlaces.add(place.place_id);
            seenPlaces.add(place.name.toLowerCase());

            let type: PointOfInterest['type'] = 'viewpoint';
            if (place.types.includes('park')) type = 'park';
            else if (place.types.includes('art_gallery') || place.types.includes('museum')) type = 'art';
            else if (place.types.includes('cafe') || place.types.includes('bakery')) type = 'coffee';
            else if (place.types.includes('bar')) type = 'bar';
            else if (place.types.includes('book_store')) type = 'art';
            else if (place.types.includes('restaurant')) type = 'restaurant';

            places.push({
              name: place.name,
              description: '',
              type,
              location: { lat: placeLat, lng: placeLng },
            });
          }
        }

      }
    }
  }

  // --- SOURCE 3: Foursquare hidden gems (cafes, bars, bookstores, galleries) ---
  if (places.length < 7) {
    // Free source: query all sample points at once, then use results in route order
    const batches = await Promise.all(
      fewSampleSteps.map((step) => searchFoursquare(step.start_location.lat, step.start_location.lng, seenPlaces))
    );
    for (const foursquarePlaces of batches) {
      if (places.length >= 7) break;

      for (const place of foursquarePlaces) {
        if (places.length >= 7) break;
        if (isTooCloseToStartOrEnd(place.location.lat, place.location.lng)) continue;
        if (seenPlaces.has(place.name.toLowerCase())) continue;
        if (isChain(place.name)) continue;

        seenPlaces.add(place.name.toLowerCase());
        places.push(place);
      }
    }
  }

  // --- SOURCE 4: OpenStreetMap Overpass for street art and murals ---
  if (places.length < 7) {
    // Free source: query all sample points at once, then use results in route order
    const batches = await Promise.all(
      fewSampleSteps.map((step) => searchOverpass(step.start_location.lat, step.start_location.lng, seenPlaces))
    );
    for (const overpassPlaces of batches) {
      if (places.length >= 7) break;

      for (const place of overpassPlaces) {
        if (places.length >= 7) break;
        if (isTooCloseToStartOrEnd(place.location.lat, place.location.lng)) continue;
        if (seenPlaces.has(place.name.toLowerCase())) continue;

        seenPlaces.add(place.name.toLowerCase());
        places.push(place);
      }
    }
  }

  // Limit to 7 places max
  return places.slice(0, 7);
}

function calculateHealthStats(distance: number, duration: number) {
  const walkTimeMinutes = Math.round(duration / 60);
  const waymoTimeMinutes = Math.max(3, Math.round(walkTimeMinutes * 0.35)); // Assume Waymo is ~35% of walk time, min 3 min

  // Average: 2000 steps per mile, distance is in meters
  const miles = distance / 1609.34;
  const steps = Math.round(miles * 2000);

  // Average: 100 calories per mile walking
  const caloriesBurned = Math.round(miles * 100);

  // Exercise equivalents - matched by calories burned
  const exerciseEquivalents = [
    { name: 'walking up one flight of stairs', cal: 5 },
    { name: 'a 10-minute stretch', cal: 25 },
    { name: 'a 15-minute walk around the block', cal: 50 },
    { name: 'a 20-minute yoga flow', cal: 90 },
    { name: 'a 30-minute Peloton ride', cal: 200 },
    { name: 'a 45-minute Pilates class', cal: 300 },
    { name: '1 SoulCycle class', cal: 500 },
    { name: '1 Barry\'s class', cal: 700 },
    { name: 'a 10k run', cal: 600 },
    { name: 'a half marathon', cal: 1200 },
  ];

  // Find the closest match by calories
  const sortedByCloseness = [...exerciseEquivalents]
    .map(e => ({ ...e, diff: Math.abs(e.cal - caloriesBurned) }))
    .sort((a, b) => a.diff - b.diff);
  const exerciseEquivalent = sortedByCloseness[0].name;

  const exerciseMinutes = walkTimeMinutes;
  const exercisePercentage = Math.min(100, Math.round((exerciseMinutes / 30) * 100));

  // HRV boost estimate: moderate walking improves HRV ~1-5ms per session
  // Scales with duration but diminishing returns past 45 min
  const hrvBoost = walkTimeMinutes <= 10 ? 1
    : walkTimeMinutes <= 20 ? 2
    : walkTimeMinutes <= 35 ? 3
    : walkTimeMinutes <= 50 ? 4
    : 5;

  return {
    walkTimeMinutes,
    waymoTimeMinutes,
    steps,
    caloriesBurned,
    exerciseEquivalent,
    exerciseMinutes,
    exercisePercentage,
    hrvBoost,
  };
}

// "foggy in marina district, clear in mission" when the two ends of the walk differ
function microclimateNote(
  start: { condition: string; temperature: number },
  end: { condition: string; temperature: number },
  neighborhoods: string[]
): string | null {
  if (start.condition === 'unknown' || end.condition === 'unknown') return null;
  const sameSky = start.condition === end.condition;
  if (sameSky && Math.abs(start.temperature - end.temperature) < 5) return null;
  const startPlace = neighborhoods[0] ? `in ${neighborhoods[0].toLowerCase()}` : 'where you started';
  const endPlace = neighborhoods.length > 1 ? `in ${neighborhoods[neighborhoods.length - 1].toLowerCase()}` : 'where you were headed';
  const describe = (w: { condition: string; temperature: number }) => (sameSky ? `${w.temperature}°` : w.condition);
  return `${describe(start)} ${startPlace}, ${describe(end)} ${endPlace}`;
}

async function getWeather(lat: number, lng: number) {
  try {
    // Using Open-Meteo API (free, no key required)
    // Also fetch hourly precipitation probability for the next 3 hours
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=precipitation_probability&temperature_unit=fahrenheit&forecast_hours=3`;
    const response = await fetch(url);
    const data = await response.json();

    const weatherCode = data.current.weather_code;
    const temp = Math.round(data.current.temperature_2m);

    // Map weather codes to conditions
    let condition = 'clear';
    if (weatherCode >= 45 && weatherCode <= 48) condition = 'foggy';
    else if (weatherCode >= 51 && weatherCode <= 67) condition = 'rainy';
    else if (weatherCode >= 71 && weatherCode <= 77) condition = 'snowy';
    else if (weatherCode >= 80 && weatherCode <= 99) condition = 'stormy';
    else if (weatherCode >= 1 && weatherCode <= 3) condition = 'cloudy';

    // Max precipitation probability in the next 3 hours
    const rainChance = Math.max(...(data.hourly?.precipitation_probability || [0]));

    return { condition, temperature: temp, rainChance };
  } catch (error) {
    return { condition: 'unknown', temperature: 60, rainChance: 0 };
  }
}

// Decode a Google encoded polyline into points
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (const coord of ['lat', 'lng'] as const) {
      let shift = 0, result = 0, byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (coord === 'lat') lat += delta; else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Every point along a step, so long straight stretches through an area are caught
function stepPoints(step: any): Array<{ lat: number; lng: number }> {
  return step.polyline?.points ? decodePolyline(step.polyline.points) : [step.start_location];
}

function checkSafetyWarnings(steps: any[]): { area: string; warning: string }[] {
  const warnings: { area: string; warning: string }[] = [];
  // Use SF timezone so night detection works on Vercel (UTC servers)
  const sfHour = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false });
  const hour = parseInt(sfHour, 10);
  const isNight = hour < 6 || hour > 21;

  for (const { lat, lng } of steps.flatMap(stepPoints)) {
    for (const area of SKETCHY_AREAS) {
      if (
        lat >= area.bounds.south &&
        lat <= area.bounds.north &&
        lng >= area.bounds.west &&
        lng <= area.bounds.east
      ) {
        // Only warn during daytime for areas that are always sketchy
        if (!isNight && !area.alwaysWarn) continue;

        const warning = isNight ? (area.warnings.night || area.warnings.day) : area.warnings.day;
        if (warning) {
          warnings.push({ area: area.name, warning });
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

    const { pickup, dropoff, avoidUnsafe, skipAi, route } = await request.json();
    // route: 'auto' (safest unless the detour is long), 'safest', or 'quickest'
    const routeMode = route ?? (avoidUnsafe === true ? 'safest' : 'quickest');

    if (!pickup || !dropoff) {
      return NextResponse.json({ error: 'Missing pickup or dropoff' }, { status: 400 });
    }

    // Catch same location entered twice
    if (pickup.toLowerCase().trim() === dropoff.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "that's... the same place. you didn't need a waymo OR a walk." },
        { status: 400 }
      );
    }

    // Get directions
    const directions = await getDirections(pickup, dropoff, routeMode !== 'quickest', routeMode === 'auto');

    // Catch absurdly short routes (under 200m / ~1 block)
    if (directions.distance < 200) {
      return NextResponse.json(
        { error: "that's literally one block. come on." },
        { status: 400 }
      );
    }



    // Run weather, neighborhoods, and places in parallel (all depend only on directions)
    const midLat = (directions.steps[0].start_location.lat + directions.steps[directions.steps.length - 1].end_location.lat) / 2;
    const midLng = (directions.steps[0].start_location.lng + directions.steps[directions.steps.length - 1].end_location.lng) / 2;
    const startLat = directions.steps[0].start_location.lat;
    const startLng = directions.steps[0].start_location.lng;
    const endLat = directions.steps[directions.steps.length - 1].end_location.lat;
    const endLng = directions.steps[directions.steps.length - 1].end_location.lng;

    const [weather, startWeather, endWeather, neighborhoods, places] = await Promise.all([
      getWeather(midLat, midLng),
      // Start and end too, for SF microclimates (Open-Meteo is free)
      getWeather(startLat, startLng),
      getWeather(endLat, endLng),
      getNeighborhoodsAlongRoute(directions.steps).catch(() => []),
      getPlacesAlongRoute(directions.steps, startLat, startLng, endLat, endLng).catch(() => []),
    ]);

    // Generate descriptions directly (avoid self-referential HTTP call that times out on Vercel)
    const walkTimeMinutes = Math.round(directions.duration / 60);
    let descriptions: string[] = [];
    let timeComparisons: { text: string }[] = [];

    // skipAi: the page fetches descriptions separately so results show sooner
    if (process.env.ANTHROPIC_API_KEY && !skipAi) {
      try {

        const poiPrompt = `You are writing one-line descriptions of SF places someone missed by taking a robotaxi instead of walking. Factual but with elevated language. You know these places well and you are simply stating what is there. Not trying to be funny or clever. Just describing what you would see, hear, or feel if you walked past.

Occasionally use slightly old-fashioned or formal phrasing — not as a gimmick, just because it fits. Think: someone who reads a lot and it has seeped into how they talk.

Places:
${places.map((p: PointOfInterest, i: number) => `${i + 1}. ${p.name} (${p.type})`).join('\n')}

MAXIMUM 12 words. One sentence or fragment. Lowercase.

Examples:
- where the painted victorians glow amber in the late afternoon light
- a winding mosaic staircase tucked between quiet gardens
- the ruins where the sea reclaims what was built
- an alley given over entirely to colour and declaration
- the prospect from the summit that diminishes the whole city
- where the sourdough has been rising since before you were born
- a bar so dimly lit you forget what century it is
- the steps are tiled in broken china and someone's devotion

State what is actually there. A view, a smell, a material, a history. For cafes, say what they actually serve or what the room feels like. For parks, say what you see from them. For bars, say what it is like inside. For murals, say what is depicted or how the paint sits on the wall.

Do not try to be poetic. Just be precise and the rest follows.

IMPORTANT: Do NOT use quotation marks. Return ONLY the descriptions, one per line, numbered to match.`;

        let timePrompt = '';
        if (walkTimeMinutes > 120) {
          timePrompt = `Generate 5 time comparisons for a ${walkTimeMinutes} minute (${Math.round(walkTimeMinutes / 60)} hour) walk that someone skipped by taking a robotaxi.

This is an insane distance to walk. The comparisons should highlight how long this is. The walk is LONGER than these things. Dry. Sarcastic. Just stating facts.

Every comparison must be about something YOU (the person) have personally done or spent time on. NOT random facts about how long things take in the world. It should feel like a personal callout.

NEVER use first person ("I", "my"). Always use second person ("you", "your").

The comparison should be roughly accurate — the thing you're comparing to should actually take less than ${walkTimeMinutes} minutes.

Examples for long walks:
- that's longer than most movies you've sat through this year
- you've had shorter oncalls
- you've spent less time in the gym this entire week

Generate 5 different comparisons. Return ONLY the comparisons, one per line.`;
        } else {
          timePrompt = `Generate 5 dry, sarcastic time comparisons for a ${walkTimeMinutes} minute walk that someone skipped by taking a robotaxi in San Francisco.

The tone is smart tech twitter. Dry. Sarcastic. Not trying hard. Just stating observations. Think people who've shipped real products, read papers, have opinions on infra. Not YC references. Not junior.

IMPORTANT: Every comparison must be about something YOU (the person) have personally done or could do. Things you've wasted time on, habits you have, actions you take. NOT random facts about how long other processes take in the world. It should feel like a personal callout.

NEVER use first person ("I", "my"). Always use second person ("you", "your").

The comparison should be roughly accurate — the thing you're comparing to should actually take around ${walkTimeMinutes} minutes, give or take. A little exaggeration is fine but it shouldn't be absurd.

AVOID: Dating jokes, relationship references, romance, going out references. Stick to tech/work/SF life only.

Examples of the vibe:
- you've spent longer waiting for CI to pass
- you scrolled twitter longer than this before getting out of bed
- shorter than your average debugging session
- that's how long you spent choosing a font for your landing page
- you've spent more time than this deciding where to eat

Don't try to be funny. Just state the comparison as a fact. Deadpan. Flat. The humor comes from the truth of it.

Generate 5 different comparisons for a ${walkTimeMinutes} minute walk. Return ONLY the comparisons, one per line.`;
        }

        const [poiResponse, timeResponse] = await Promise.all([
          generateText(poiPrompt),
          generateText(timePrompt),
        ]);

        const descriptionsText = poiResponse;
        descriptions = descriptionsText
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
          .map((line) => line.replace(/^["']|["']$/g, ''));

        const timeComparisonsText = timeResponse;
        timeComparisons = timeComparisonsText
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => line.replace(/^\d+\.\s*/, '').trim())
          .map((line) => line.replace(/^-\s*/, '').trim())
          .filter((line) => line.length > 0)
          .map((text) => ({ text }));
      } catch (error) {
        console.error('Claude error (non-fatal):', error);
      }
    }

    // Add descriptions to places
    const pointsOfInterest = places.map((place, i) => ({
      ...place,
      description: skipAi ? '' : descriptions[i] || FALLBACK_DESCRIPTIONS[i % FALLBACK_DESCRIPTIONS.length],
    }));

    // Calculate health stats
    const healthStats = calculateHealthStats(directions.distance, directions.duration);

    // Check safety warnings
    const safetyWarnings = checkSafetyWarnings(directions.steps);

    // Check if route has parks
    const hasParks = pointsOfInterest.some(poi => poi.type === 'park');

    // Calculate verdict
    const verdict = calculateVerdict(safetyWarnings, weather, healthStats.walkTimeMinutes, hasParks, directions.distance, neighborhoods, pointsOfInterest.map(p => p.name));

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
      weatherNote: microclimateNote(startWeather, endWeather, neighborhoods),
      neighborhoods,
      pointsOfInterest,
      healthStats,
      timeComparisons: timeComparisons.length || skipAi
        ? timeComparisons
        : FALLBACK_TIME_COMPARISONS.map((text) => ({ text })),
      safetyWarnings,
      isSaferRoute: directions.rerouted,
      extraWalkMinutes: Math.round(directions.extraSeconds / 60),
      saferRouteExtraMinutes: Math.round(directions.declinedDetourSeconds / 60),
      // Free deep link: opens this same walk (including any safer detour) in Google Maps
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${
        directions.viaPoints.length ? `&waypoints=${encodeURIComponent(directions.viaPoints.map((p) => `${p.lat},${p.lng}`).join('|'))}` : ''
      }`,
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
          error.message.includes('only works in the bay area') ||
          error.message === DAILY_LIMIT_MESSAGE) {
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
