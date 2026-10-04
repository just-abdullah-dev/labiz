import { db, setSetting, getSetting } from './db';
import { BackupData } from './types';
import { shareOrDownloadFile } from './excel';

export async function createBackup(): Promise<{ blob: Blob; filename: string; stats: any }> {
  const classes = await db.classes.toArray();
  const students = await db.students.toArray();
  const labSessions = await db.labSessions.toArray();
  const entries = await db.entries.toArray();
  const settings = await db.settings.toArray();

  const backupData: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      classes,
      students,
      labSessions,
      entries,
      settings,
    },
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `LabViva_Backup_${dateStr}.json`;

  // Update last backup date in settings
  await setSetting('lastBackupDate', new Date().toISOString());

  return {
    blob,
    filename,
    stats: {
      classesCount: classes.length,
      studentsCount: students.length,
      labsCount: labSessions.length,
      entriesCount: entries.length,
    },
  };
}

export async function parseBackupFile(file: File): Promise<{
  backupData: BackupData;
  summary: {
    classesCount: number;
    studentsCount: number;
    labsCount: number;
    entriesCount: number;
    exportedAt: string;
  };
}> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON file. Please provide a valid LabViva backup file.');
  }

  if (!parsed.data || !Array.isArray(parsed.data.classes)) {
    throw new Error('Unrecognized backup format. Missing required data tables.');
  }

  const { classes = [], students = [], labSessions = [], entries = [], settings = [] } = parsed.data;

  return {
    backupData: parsed as BackupData,
    summary: {
      classesCount: classes.length,
      studentsCount: students.length,
      labsCount: labSessions.length,
      entriesCount: entries.length,
      exportedAt: parsed.exportedAt || 'Unknown',
    },
  };
}

export async function restoreBackup(backupData: BackupData): Promise<void> {
  const { classes = [], students = [], labSessions = [], entries = [], settings = [] } = backupData.data;

  await db.transaction('rw', [db.classes, db.students, db.labSessions, db.entries, db.settings], async () => {
    await db.classes.clear();
    await db.students.clear();
    await db.labSessions.clear();
    await db.entries.clear();
    await db.settings.clear();

    if (classes.length) await db.classes.bulkAdd(classes);
    if (students.length) await db.students.bulkAdd(students);
    if (labSessions.length) await db.labSessions.bulkAdd(labSessions);
    if (entries.length) await db.entries.bulkAdd(entries);
    if (settings.length) await db.settings.bulkAdd(settings);

    // Record restore date as last backup date so the user isn't immediately nagged
    await db.settings.put({ key: 'lastBackupDate', value: new Date().toISOString() });
  });
}

export async function getLastBackupInfo(): Promise<{ daysAgo: number | null; dateStr: string | null; needsBackup: boolean }> {
  const lastBackupStr = await getSetting<string>('lastBackupDate');
  if (!lastBackupStr) {
    return { daysAgo: null, dateStr: null, needsBackup: true };
  }

  const lastBackupTime = new Date(lastBackupStr).getTime();
  const diffMs = Date.now() - lastBackupTime;
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysAgo,
    dateStr: new Date(lastBackupStr).toLocaleDateString(),
    needsBackup: daysAgo >= 7,
  };
}

export async function resetAllData(): Promise<void> {
  await db.transaction('rw', [db.classes, db.students, db.labSessions, db.entries, db.settings], async () => {
    await db.classes.clear();
    await db.students.clear();
    await db.labSessions.clear();
    await db.entries.clear();
    await db.settings.clear();
  });
}
