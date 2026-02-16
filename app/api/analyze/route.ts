import { NextRequest, NextResponse } from 'next/server';
import type { AnalysisResult, PointOfInterest } from '@/lib/types';
import { checkRateLimit } from '@/lib/ratelimit';

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
    warnings: {
      day: "just keep your head on a swivel around here",
      night: "not the best area to be wandering after dark"
    }
  },
  {
    name: 'mid-market',
    bounds: { north: 37.7840, south: 37.7800, west: -122.4140, east: -122.4080 },
    warnings: {
      day: "this stretch can be a bit much",
      night: "not the vibe for a night stroll"
    }
  },
  {
    name: 'soma (6th st)',
    bounds: { north: 37.7820, south: 37.7750, west: -122.4100, east: -122.4050 },
    warnings: {
      day: "this block has a lot going on",
      night: "you don't want to be walking here at night"
    }
  },
  {
    name: 'bayview',
    bounds: { north: 37.7350, south: 37.7100, west: -122.3950, east: -122.3700 },
    warnings: {
      day: "stay aware around this part of the route",
      night: "definitely not a walking-at-night situation"
    }
  },
  {
    name: 'hunters point',
    bounds: { north: 37.7350, south: 37.7200, west: -122.3850, east: -122.3600 },
    warnings: {
      day: "not the most pedestrian-friendly stretch",
      night: "hard pass on walking here after dark"
    }
  },
  {
    name: 'western addition',
    bounds: { north: 37.7850, south: 37.7750, west: -122.4350, east: -122.4200 },
    warnings: {
      day: "some blocks around here can be iffy",
      night: "not ideal for a late night walk"
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

        const response = await fetch(url);
        const data = await response.json();

        if (data.results) {
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

        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  // --- SOURCE 3: Foursquare hidden gems (cafes, bars, bookstores, galleries) ---
  if (places.length < 7) {
    for (const step of fewSampleSteps) {
      if (places.length >= 7) break;

      const lat = step.start_location.lat;
      const lng = step.start_location.lng;

      const foursquarePlaces = await searchFoursquare(lat, lng, seenPlaces);

      for (const place of foursquarePlaces) {
        if (places.length >= 7) break;
        if (isTooCloseToStartOrEnd(place.location.lat, place.location.lng)) continue;
        if (isChain(place.name)) continue;

        seenPlaces.add(place.name.toLowerCase());
        places.push(place);
      }
    }
  }

  // --- SOURCE 4: OpenStreetMap Overpass for street art and murals ---
  if (places.length < 7) {
    for (const step of fewSampleSteps) {
      if (places.length >= 7) break;

      const lat = step.start_location.lat;
      const lng = step.start_location.lng;

      const overpassPlaces = await searchOverpass(lat, lng, seenPlaces);

      for (const place of overpassPlaces) {
        if (places.length >= 7) break;
        if (isTooCloseToStartOrEnd(place.location.lat, place.location.lng)) continue;

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

  // Exercise equivalents
  const exerciseEquivalents = [
    { name: 'one flight of stairs', min: 1, max: 3 },
    { name: 'a warm-up jog', min: 4, max: 8 },
    { name: 'a quick yoga flow', min: 9, max: 15 },
    { name: '20 min HIIT workout', min: 16, max: 25 },
    { name: '30 min peloton ride', min: 26, max: 35 },
    { name: '40 min yoga flow', min: 36, max: 44 },
    { name: '1 SoulCycle class', min: 45, max: 55 },
    { name: '1 Barry\'s class', min: 56, max: 70 },
    { name: 'a proper long run', min: 71, max: 90 },
    { name: 'a half marathon at a chill pace', min: 91, max: 150 },
  ];

  const matchingExercise = exerciseEquivalents.find(
    (e) => walkTimeMinutes >= e.min && walkTimeMinutes <= e.max
  );
  const exerciseEquivalent = matchingExercise
    ? matchingExercise.name
    : `a ${walkTimeMinutes}-minute workout`;

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
    if (weatherCode >= 45 && weatherCode <= 48) condition = 'foggy';
    else if (weatherCode >= 51 && weatherCode <= 67) condition = 'rainy';
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
      reason: `${distanceFeet} feet by ${ride}... that's honestly just lazy 🤍`,
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

  // Edge case: Absurdly long walks (over 2 hours)
  if (walkTimeMinutes > 120) {
    return {
      worthIt: true,
      reason: `${Math.round(walkTimeMinutes / 60)} hours of walking... that's a day hike. ${ride} was smart 💀`,
    };
  }

  // Edge case: Very long walks (over 90 minutes) - but if it's gorgeous out with parks, still guilt trip
  if (walkTimeMinutes > 90 && !(weather.condition === 'clear' && weather.temperature > 55 && weather.temperature < 80 && hasParks && safetyWarnings.length === 0)) {
    return {
      worthIt: true,
      reason: 'this would\'ve been more exercise than most people get in a week... 😭',
    };
  }
  // 60-90 min walks: guilt trip if weather is decent and it's safe
  if (walkTimeMinutes > 60 && safetyWarnings.length === 0 && weather.condition !== 'stormy' && weather.temperature > 50 && weather.temperature < 85) {
    if (hasParks && weather.condition === 'clear') {
      return {
        worthIt: false,
        reason: `${walkTimeMinutes} minutes through parks on a ${weather.temperature}° day... yeah you missed out 🥀`,
      };
    }
    return {
      worthIt: false,
      reason: `${walkTimeMinutes} minutes is a real walk... but that's the whole point 🥀`,
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
      reason: `${walkTimeMinutes} minutes in the fog... that\'s peak SF walking weather 🌫️`,
    };
  }

  // Rain: don't discourage walking, just give practical advice
  if (weather.condition === 'rainy' || weather.condition === 'stormy') {
    const hasStairsOrHills = poiNames.some(name =>
      /step|stair|hill|heights|peak/i.test(name)
    );

    if (weather.condition === 'stormy') {
      return {
        worthIt: true,
        reason: `stormy out there... ${ride} was the right call today`,
      };
    }
    if (hasStairsOrHills) {
      return {
        worthIt: false,
        reason: 'grab an umbrella and watch your step on those hills... it gets slippery 🌧️',
      };
    }
    if (walkTimeMinutes > 45) {
      return {
        worthIt: false,
        reason: `${walkTimeMinutes} minutes in the rain is a commitment... but SF in the rain hits different 🌧️`,
      };
    }
    return {
      worthIt: false,
      reason: 'a little rain never hurt anyone... just bring an umbrella 🌧️',
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
      reason: `${weather.temperature}° is perfectly reasonable ${ride} weather ☹️`,
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
      reason: `${walkTimeMinutes} minutes with nothing pretty to see... ${ride} was fair 😔`,
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

    // Catch same location entered twice
    if (pickup.toLowerCase().trim() === dropoff.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "that's... the same place. you didn't need a waymo OR a walk." },
        { status: 400 }
      );
    }

    // Get directions
    const directions = await getDirections(pickup, dropoff);

    // Catch absurdly short routes (under 200m / ~1 block)
    if (directions.distance < 200) {
      return NextResponse.json(
        { error: "that's literally one block. come on." },
        { status: 400 }
      );
    }

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

    const descData = await response.json();
    const descriptions = descData.descriptions || [];
    const timeComparisons = descData.timeComparisons || [];

    // Add descriptions to places
    const pointsOfInterest = places.map((place, i) => ({
      ...place,
      description: descriptions[i] || 'a place worth seeing',
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
