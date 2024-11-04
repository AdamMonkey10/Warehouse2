import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Item } from '@/types/warehouse';

const COLLECTION = 'items';

interface CreateItemData {
  itemCode: string;
  systemCode: string;
  description: string;
  weight: number;
  category: string;
  status: 'pending' | 'placed' | 'removed';
  metadata?: {
    coilNumber?: string;
    coilLength?: string;
  };
  department?: string;
}

export async function addItem(data: CreateItemData): Promise<string> {
  try {
    // Validate required fields
    if (!data.itemCode || !data.systemCode || !data.description || !data.category) {
      throw new Error('Missing required fields');
    }

    // Ensure weight is a valid number
    if (isNaN(data.weight) || data.weight <= 0) {
      throw new Error('Invalid weight value');
    }

    // Validate category
    const validCategories = ['raw', 'finished', 'packaging', 'spare'];
    if (!validCategories.includes(data.category)) {
      throw new Error('Invalid category');
    }

    // Validate status
    const validStatuses = ['pending', 'placed', 'removed'];
    if (!validStatuses.includes(data.status)) {
      throw new Error('Invalid status');
    }

    // Create the item document with all required fields
    const itemData = {
      itemCode: data.itemCode.trim(),
      systemCode: data.systemCode.trim(),
      description: data.description.trim(),
      weight: Number(data.weight),
      category: data.category,
      status: data.status,
      locationVerified: false,
      metadata: data.metadata || null,
      department: data.department?.trim() || null,
      lastUpdated: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), itemData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

export async function updateItem(id: string, data: Partial<Item>) {
  try {
    if (!id) {
      throw new Error('Item ID is required');
    }

    // Validate weight if provided
    if (data.weight !== undefined && (isNaN(data.weight) || data.weight <= 0)) {
      throw new Error('Invalid weight value');
    }

    // Validate category if provided
    if (data.category) {
      const validCategories = ['raw', 'finished', 'packaging', 'spare'];
      if (!validCategories.includes(data.category)) {
        throw new Error('Invalid category');
      }
    }

    // Validate status if provided
    if (data.status) {
      const validStatuses = ['pending', 'placed', 'removed'];
      if (!validStatuses.includes(data.status)) {
        throw new Error('Invalid status');
      }
    }

    const updateData = {
      ...data,
      lastUpdated: serverTimestamp(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

export async function deleteItem(id: string) {
  try {
    if (!id) {
      throw new Error('Item ID is required');
    }

    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

export async function getItems() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items:', error);
    throw error;
  }
}

export async function getItemsByLocation(location: string) {
  try {
    if (!location?.trim()) {
      throw new Error('Location is required');
    }

    const q = query(
      collection(db, COLLECTION),
      where('location', '==', location.trim())
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items by location:', error);
    throw error;
  }
}

export async function getItemsByStatus(status: string) {
  try {
    if (!status) {
      throw new Error('Status is required');
    }

    const validStatuses = ['pending', 'placed', 'removed'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Item[];
  } catch (error) {
    console.error('Error getting items by status:', error);
    throw error;
  }
}