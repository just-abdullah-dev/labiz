export interface ClassItem {
  id: string;
  courseTitle: string;
  section: string;
  session: string;
  createdAt: string;
}

export interface StudentItem {
  id: string;
  classId: string;
  serialNo: number;
  regNo: string;
  name: string;
  batch: string;
}

export interface LabSessionItem {
  id: string;
  classId: string;
  labNo: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface EntryItem {
  id: string;
  labSessionId: string;
  studentId: string;
  remarkKey: string | null;
  note: string | null;
  updatedAt: string; // ISO string
}

export interface RemarkScaleItem {
  key: string;
  label: string;
  marks: number;
  color: string;
  textColor: string;
  bgLight: string;
  borderColor: string;
}

export interface AppSettingItem {
  key: string;
  value: any;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    classes: ClassItem[];
    students: StudentItem[];
    labSessions: LabSessionItem[];
    entries: EntryItem[];
    settings: AppSettingItem[];
  };
}
