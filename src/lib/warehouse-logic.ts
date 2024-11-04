import type { Location } from '@/types/warehouse';

// Weight limits per level (in kg)
export const LEVEL_MAX_WEIGHTS = {
  '0': 2000, // Ground level
  '1': 1500, // First level
  '2': 1000, // Second level
  '3': 750,  // Third level
  '4': 500,  // Fourth level
};

export function getLevelId(location: Location): string {
  return `${location.row}${location.bay}-${location.level}`;
}

export function getLevelWeight(locations: Location[]): number {
  return locations.reduce((total, loc) => total + (loc.currentWeight || 0), 0);
}

export function canAcceptWeight(location: Location, weight: number, levelLocations: Location[]): boolean {
  // Check if location is available and verified
  if (!location.available || !location.verified) {
    return false;
  }

  // Calculate current level weight including the new weight
  const currentLevelWeight = getLevelWeight(levelLocations);
  const newLevelWeight = currentLevelWeight + weight;

  // Check level weight limit
  const levelMaxWeight = LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
  if (newLevelWeight > levelMaxWeight) {
    return false;
  }

  return true;
}

// Calculate distance score (lower is better)
function calculateDistanceScore(row: string, bay: string): number {
  const rowScore = (row.charCodeAt(0) - 'A'.charCodeAt(0)) * 100;
  const bayScore = parseInt(bay) - 1;
  return rowScore + bayScore;
}

// Calculate weight suitability score (lower is better)
function calculateWeightScore(weight: number, level: string, levelLocations: Location[]): number {
  const levelNum = parseInt(level);
  const levelMaxWeight = LEVEL_MAX_WEIGHTS[level as keyof typeof LEVEL_MAX_WEIGHTS];
  
  // Calculate current level weight
  const currentLevelWeight = getLevelWeight(levelLocations);
  const newLevelWeight = currentLevelWeight + weight;

  // Heavy penalty for exceeding level weight limits
  if (newLevelWeight > levelMaxWeight) {
    return Number.MAX_SAFE_INTEGER;
  }

  // Penalize putting heavy items on higher levels
  const heightPenalty = weight * levelNum * 2;
  
  // Penalize inefficient use of weight capacity
  const capacityScore = Math.abs(levelMaxWeight - newLevelWeight);
  
  // Additional penalty for nearly full levels
  const levelUtilization = newLevelWeight / levelMaxWeight;
  const levelPenalty = levelUtilization * 1000;

  return heightPenalty + capacityScore + levelPenalty;
}

export function findOptimalLocation(locations: Location[], weight: number): Location | null {
  // Filter for available and verified locations first
  const availableLocations = locations.filter(loc => loc.available && loc.verified);
  
  if (availableLocations.length === 0) {
    return null;
  }

  // Group locations by level (combining all locations in the same level of a bay)
  const levelGroups = availableLocations.reduce((groups, loc) => {
    const levelKey = `${loc.row}${loc.bay}-${loc.level}`; // e.g., "A01-4" for all locations in level 4 of bay A01
    if (!groups[levelKey]) {
      groups[levelKey] = [];
    }
    groups[levelKey].push(loc);
    return groups;
  }, {} as Record<string, Location[]>);

  // Filter locations that can accept the weight based on level capacity
  const validLocations = availableLocations.filter(location => {
    const levelKey = `${location.row}${location.bay}-${location.level}`;
    const levelLocations = levelGroups[levelKey];
    return canAcceptWeight(location, weight, levelLocations);
  });

  if (validLocations.length === 0) {
    return null;
  }

  // Score each location based on multiple factors
  const scoredLocations = validLocations.map(location => {
    const levelKey = `${location.row}${location.bay}-${location.level}`;
    const levelLocations = levelGroups[levelKey];
    const distanceScore = calculateDistanceScore(location.row, location.bay);
    const weightScore = calculateWeightScore(weight, location.level, levelLocations);
    
    return {
      location,
      score: distanceScore + weightScore
    };
  }).filter(scored => scored.score !== Number.MAX_SAFE_INTEGER);

  if (scoredLocations.length === 0) {
    return null;
  }

  // Sort by score (lower is better) and return the best location
  scoredLocations.sort((a, b) => a.score - b.score);
  return scoredLocations[0].location;
}