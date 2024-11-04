import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Item } from '@/types/warehouse';

const COLLECTION = 'actions';

export interface WarehouseAction {
  id: string;
  itemId: string;
  itemCode: string;
  systemCode: string;
  description: string;
  category: string;
  weight: number;
  location?: string;
  actionType: 'in' | 'out';
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: any;
  operator?: string;
  department?: string;
}

interface CreateActionData {
  itemId: string;
  itemCode: string;
  systemCode: string;
  description: string;
  category: string;
  weight: number;
  location?: string;
  actionType: 'in' | 'out';
  status: 'pending' | 'in-progress' | 'completed';
  operator?: string;
  department?: string;
}

export async function addAction(data: CreateActionData): Promise<string> {
  try {
    // Validate required fields
    if (!data.itemId || !data.itemCode || !data.systemCode || !data.description || !data.category) {
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

    // Validate action type
    const validActionTypes = ['in', 'out'];
    if (!validActionTypes.includes(data.actionType)) {
      throw new Error('Invalid action type');
    }

    // Validate status
    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (!validStatuses.includes(data.status)) {
      throw new Error('Invalid status');
    }

    // Create the action document with all required fields
    const actionData = {
      itemId: data.itemId,
      itemCode: data.itemCode.trim(),
      systemCode: data.systemCode.trim(),
      description: data.description.trim(),
      category: data.category,
      weight: Number(data.weight),
      location: data.location?.trim() || null,
      actionType: data.actionType,
      status: data.status,
      operator: data.operator?.trim() || null,
      department: data.department?.trim() || null,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION), actionData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding action:', error);
    throw error;
  }
}

export async function updateAction(id: string, data: Partial<WarehouseAction>) {
  try {
    if (!id) {
      throw new Error('Action ID is required');
    }

    // Validate status if provided
    if (data.status) {
      const validStatuses = ['pending', 'in-progress', 'completed'];
      if (!validStatuses.includes(data.status)) {
        throw new Error('Invalid status');
      }
    }

    const updateData = {
      ...data,
      timestamp: serverTimestamp(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating action:', error);
    throw error;
  }
}

export async function deleteAction(id: string) {
  try {
    if (!id) {
      throw new Error('Action ID is required');
    }

    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting action:', error);
    throw error;
  }
}

export async function getActions() {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as WarehouseAction[];
  } catch (error) {
    console.error('Error getting actions:', error);
    throw error;
  }
}

export async function getPendingActions() {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as WarehouseAction[];
  } catch (error) {
    console.error('Error getting pending actions:', error);
    throw error;
  }
}

export function subscribeToActions(callback: (actions: WarehouseAction[]) => void) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['pending', 'in-progress']),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const actions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as WarehouseAction[];
      callback(actions);
    });
  } catch (error) {
    console.error('Error subscribing to actions:', error);
    throw error;
  }
}

export async function createGoodsInAction(item: Item & { id: string }) {
  try {
    if (!item.id || !item.systemCode || !item.itemCode || !item.description || !item.category) {
      throw new Error('Invalid item data: missing required fields');
    }

    return await addAction({
      itemId: item.id,
      itemCode: item.itemCode,
      systemCode: item.systemCode,
      description: item.description,
      category: item.category,
      weight: item.weight,
      actionType: 'in',
      status: 'pending',
      department: item.department,
    });
  } catch (error) {
    console.error('Error creating goods-in action:', error);
    throw error;
  }
}

export async function createPickAction(item: Item & { id: string }, department: string) {
  try {
    if (!item.id || !item.systemCode || !item.itemCode || !item.description || !item.category) {
      throw new Error('Invalid item data: missing required fields');
    }

    if (!department?.trim()) {
      throw new Error('Department is required for pick actions');
    }

    return await addAction({
      itemId: item.id,
      itemCode: item.itemCode,
      systemCode: item.systemCode,
      description: item.description,
      category: item.category,
      weight: item.weight,
      location: item.location,
      actionType: 'out',
      status: 'pending',
      department: department.trim(),
    });
  } catch (error) {
    console.error('Error creating pick action:', error);
    throw error;
  }
}