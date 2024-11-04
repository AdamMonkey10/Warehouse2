import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Movement } from '@/types/warehouse';

const COLLECTION = 'movements';

export async function addMovement(movement: Omit<Movement, 'id' | 'timestamp'>) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...movement,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
}

export async function getMovements() {
  const q = query(
    collection(db, COLLECTION),
    orderBy('timestamp', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Movement[];
}

export async function getMovementsByType(type: 'IN' | 'OUT') {
  const q = query(
    collection(db, COLLECTION),
    where('type', '==', type),
    orderBy('timestamp', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Movement[];
}