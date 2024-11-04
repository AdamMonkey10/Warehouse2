import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { LEVEL_MAX_WEIGHTS, getLevelId, getLevelWeight } from '../warehouse-logic';
import type { Location } from '@/types/warehouse';

const COLLECTION = 'locations';

export async function getAvailableLocations(requiredWeight: number) {
  try {
    // Get all available and verified locations
    const q = query(
      collection(db, COLLECTION),
      where('available', '==', true),
      where('verified', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const locations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Location[];

    // Group locations by level
    const levelLocations = locations.reduce((acc, location) => {
      const levelId = getLevelId(location);
      if (!acc[levelId]) acc[levelId] = [];
      acc[levelId].push(location);
      return acc;
    }, {} as Record<string, Location[]>);

    // Filter locations that can accept the weight based on level limits
    return locations.filter(location => {
      const levelId = getLevelId(location);
      const currentLevelWeight = getLevelWeight(levelLocations[levelId] || []);
      const levelMaxWeight = LEVEL_MAX_WEIGHTS[location.level as keyof typeof LEVEL_MAX_WEIGHTS];
      
      return currentLevelWeight + requiredWeight <= levelMaxWeight;
    });
  } catch (error) {
    console.error('Error getting available locations:', error);
    throw error;
  }
}

export async function addLocation(location: Omit<Location, 'id'>) {
  const maxWeight = LEVEL_MAX_WEIGHTS[location.level];
  
  const locationWithDefaults = {
    ...location,
    maxWeight,
    currentWeight: 0,
    available: true,
    verified: true,
  };

  const docRef = await addDoc(collection(db, COLLECTION), locationWithDefaults);
  return docRef.id;
}

export async function updateLocation(id: string, data: Partial<Location>) {
  try {
    const locationRef = doc(db, COLLECTION, id);
    
    await updateDoc(locationRef, {
      ...data,
      // Ensure available is properly set based on weight
      available: data.currentWeight ? data.currentWeight === 0 : true
    });
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

export async function getLevelLocations(row: string, bay: string, level: string) {
  const q = query(
    collection(db, COLLECTION),
    where('row', '==', row),
    where('bay', '==', bay),
    where('level', '==', level)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Location[];
}

export async function getLocations() {
  const querySnapshot = await getDocs(collection(db, COLLECTION));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Location[];
}

export async function getLocationByCode(code: string) {
  const q = query(
    collection(db, COLLECTION),
    where('code', '==', code)
  );
  const querySnapshot = await getDocs(q);
  const locations = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Location[];
  return locations[0] || null;
}

export async function initializeLocationIndexes() {
  const querySnapshot = await getDocs(collection(db, COLLECTION));
  const batch = writeBatch(db);
  let updates = 0;

  for (const docSnapshot of querySnapshot.docs) {
    const location = docSnapshot.data() as Location;
    const maxWeight = LEVEL_MAX_WEIGHTS[location.level] || 500;
    
    if (!location.maxWeight || location.available === undefined || location.verified === undefined) {
      const locationRef = doc(db, COLLECTION, docSnapshot.id);
      batch.update(locationRef, {
        maxWeight,
        currentWeight: location.currentWeight || 0,
        available: true,
        verified: true
      });
      updates++;
    }
  }

  if (updates > 0) {
    await batch.commit();
  }

  return updates;
}