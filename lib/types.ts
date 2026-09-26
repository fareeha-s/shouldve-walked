export interface PointOfInterest {
  name: string;
  description: string;
  type: 'coffee' | 'restaurant' | 'bar' | 'mural' | 'art' | 'park' | 'viewpoint' | 'nature';
  location: {
    lat: number;
    lng: number;
  };
}

export interface HealthStats {
  walkTimeMinutes: number;
  waymoTimeMinutes: number;
  steps: number;
  caloriesBurned: number;
  exerciseEquivalent: string;
  exerciseMinutes: number;
  exercisePercentage: number;
  hrvBoost: number;
}

export interface TimeComparison {
  text: string;
}

export interface SafetyWarning {
  area: string;
  warning: string;
}

export interface AnalysisResult {
  route: {
    distance: number; // in meters
    duration: number; // in seconds
    polyline: string;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  };
  verdict: {
    worthIt: boolean;
    reason: string;
  };
  weather: {
    condition: string;
    temperature: number;
    rainChance: number;
  };
  neighborhoods: string[];
  pointsOfInterest: PointOfInterest[];
  healthStats: HealthStats;
  timeComparisons: TimeComparison[];
  safetyWarnings: SafetyWarning[];
  isSaferRoute?: boolean;
  extraWalkMinutes?: number;
  saferRouteExtraMinutes?: number;
  googleMapsUrl?: string;
}
