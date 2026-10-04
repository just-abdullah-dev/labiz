// Storage persistence and health utilities

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persisted status: ${isPersisted}`);
      return isPersisted;
    } catch (e) {
      console.warn('[Storage] Error requesting persistence:', e);
      return false;
    }
  }
  return false;
}

export async function checkStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch (e) {
      return false;
    }
  }
  return false;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percent: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return { usage, quota, percent };
    } catch (e) {
      return { usage: 0, quota: 0, percent: 0 };
    }
  }
  return { usage: 0, quota: 0, percent: 0 };
}
