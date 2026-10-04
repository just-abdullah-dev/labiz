import Dexie, { Table } from 'dexie';
import {
  ClassItem,
  StudentItem,
  LabSessionItem,
  EntryItem,
  AppSettingItem,
  RemarkScaleItem,
} from './types';

export const DEFAULT_REMARK_SCALES: RemarkScaleItem[] = [
  {
    key: 'excellent',
    label: 'Excellent',
    marks: 10,
    color: '#15803d', // dark green
    textColor: '#ffffff',
    bgLight: '#dcfce7',
    borderColor: '#16a34a',
  },
  {
    key: 'very_good',
    label: 'Very Good',
    marks: 8,
    color: '#16a34a', // green
    textColor: '#ffffff',
    bgLight: '#f0fdf4',
    borderColor: '#22c55e',
  },
  {
    key: 'good',
    label: 'Good',
    marks: 7,
    color: '#65a30d', // light green
    textColor: '#ffffff',
    bgLight: '#f7fee7',
    borderColor: '#84cc16',
  },
  {
    key: 'satisfactory',
    label: 'Satisfactory',
    marks: 5,
    color: '#ca8a04', // yellow
    textColor: '#ffffff',
    bgLight: '#fefce8',
    borderColor: '#eab308',
  },
  {
    key: 'weak',
    label: 'Weak',
    marks: 3,
    color: '#ea580c', // orange
    textColor: '#ffffff',
    bgLight: '#fff7ed',
    borderColor: '#f97316',
  },
  {
    key: 'unsatisfactory',
    label: 'Unsatisfactory',
    marks: 1,
    color: '#dc2626', // red
    textColor: '#ffffff',
    bgLight: '#fef2f2',
    borderColor: '#ef4444',
  },
];

export class LabVivaDB extends Dexie {
  classes!: Table<ClassItem, string>;
  students!: Table<StudentItem, string>;
  labSessions!: Table<LabSessionItem, string>;
  entries!: Table<EntryItem, string>;
  settings!: Table<AppSettingItem, string>;

  constructor() {
    super('LabVivaDB');
    this.version(1).stores({
      classes: 'id, courseTitle, section, session, createdAt',
      students: 'id, classId, serialNo, regNo, [classId+regNo]',
      labSessions: 'id, classId, labNo, [classId+labNo]',
      entries: 'id, labSessionId, studentId, [labSessionId+studentId]',
      settings: 'key',
    });
  }
}

export const db = new LabVivaDB();

// Helper to initialize or retrieve app settings
export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  try {
    const item = await db.settings.get(key);
    return item ? (item.value as T) : defaultValue;
  } catch (err) {
    console.error(`Failed to get setting ${key}:`, err);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: any): Promise<void> {
  try {
    await db.settings.put({ key, value });
  } catch (err) {
    console.error(`Failed to set setting ${key}:`, err);
    throw err;
  }
}

export async function getRemarkScales(): Promise<RemarkScaleItem[]> {
  const customScales = await getSetting<RemarkScaleItem[]>('remarkScales');
  if (customScales && Array.isArray(customScales) && customScales.length >= 6) {
    return customScales;
  }
  return DEFAULT_REMARK_SCALES;
}
