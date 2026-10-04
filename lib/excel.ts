import * as XLSX from 'xlsx';
import { ClassItem, StudentItem, LabSessionItem, EntryItem, RemarkScaleItem } from './types';

export interface ParsedStudent {
  serialNo: number;
  regNo: string;
  name: string;
  batch: string;
}

export interface ParsedClassData {
  courseTitle: string;
  section: string;
  session: string;
  students: ParsedStudent[];
}

export interface ReconciliationResult {
  toAdd: ParsedStudent[];
  toUpdate: { existing: StudentItem; updated: ParsedStudent }[];
  missing: StudentItem[];
  unchangedCount: number;
}

// Clean text: trim and collapse repeated whitespace
export function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

// Normalize key for header matching
function normalizeKey(val: any): string {
  return cleanText(val).toLowerCase().replace(/[\s._\-#]/g, '');
}

export function parseUniversityExcel(arrayBuffer: ArrayBuffer): ParsedClassData {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  if (!workbook.SheetNames.length) {
    throw new Error('The uploaded Excel file has no sheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('The Excel sheet appears to be empty.');
  }

  let courseTitle = '';
  let section = '';
  let session = '';
  let headerRowIndex = -1;

  let sNoCol = -1;
  let regNoCol = -1;
  let nameCol = -1;
  let batchCol = -1;

  // Scan the first 15 rows to detect metadata and the header row containing "Reg No"
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r] || [];

    for (let c = 0; c < row.length; c++) {
      const cellVal = cleanText(row[c]);
      const normCell = normalizeKey(row[c]);

      // Look for Course Title metadata
      if (normCell === 'coursetitle' || normCell === 'course') {
        courseTitle = cleanText(row[c + 1]);
      }
      // Look for Section metadata
      if (normCell === 'section') {
        section = cleanText(row[c + 1]);
      }
      // Look for Session metadata
      if (normCell === 'session') {
        session = cleanText(row[c + 1]);
      }

      // Detect header row by finding "Reg No"
      if (normCell === 'regno' || normCell === 'registrationno') {
        headerRowIndex = r;
      }
    }

    if (headerRowIndex !== -1) {
      // Find column indices in the header row
      for (let c = 0; c < row.length; c++) {
        const normHeader = normalizeKey(row[c]);
        if (normHeader === 's' || normHeader === 'sno' || normHeader === 'sr' || normHeader === 'srno') {
          sNoCol = c;
        } else if (normHeader === 'regno' || normHeader === 'registrationno') {
          regNoCol = c;
        } else if (
          normHeader === 'studentname' ||
          normHeader === 'name' ||
          normHeader === 'fullname'
        ) {
          nameCol = c;
        } else if (normHeader === 'batch') {
          batchCol = c;
        }
      }
      break;
    }
  }

  if (headerRowIndex === -1 || regNoCol === -1) {
    throw new Error(
      'Could not find the "Reg No." column header. Please ensure the Excel sheet contains a "Reg No." column.'
    );
  }

  const students: ParsedStudent[] = [];
  const seenRegNos = new Set<string>();

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const regNo = regNoCol !== -1 ? cleanText(row[regNoCol]) : '';

    // Skip rows with empty Reg No
    if (!regNo) continue;

    // Skip duplicates within the same sheet
    if (seenRegNos.has(regNo.toUpperCase())) continue;
    seenRegNos.add(regNo.toUpperCase());

    const name = nameCol !== -1 ? cleanText(row[nameCol]) : '';
    const batch = batchCol !== -1 ? cleanText(row[batchCol]) : '';
    const rawSNo = sNoCol !== -1 && row[sNoCol] !== undefined ? Number(row[sNoCol]) : null;
    const serialNo = Number.isFinite(rawSNo) && (rawSNo as number) > 0 ? (rawSNo as number) : students.length + 1;

    // Do NOT import emails or phone numbers (privacy requirement)
    students.push({
      serialNo,
      regNo,
      name,
      batch,
    });
  }

  return {
    courseTitle: courseTitle || 'New Course',
    section: section || '',
    session: session || '',
    students,
  };
}

export function reconcileStudents(
  existingStudents: StudentItem[],
  incomingStudents: ParsedStudent[]
): ReconciliationResult {
  const existingMap = new Map<string, StudentItem>();
  for (const s of existingStudents) {
    existingMap.set(s.regNo.trim().toUpperCase(), s);
  }

  const incomingMap = new Map<string, ParsedStudent>();
  const toAdd: ParsedStudent[] = [];
  const toUpdate: { existing: StudentItem; updated: ParsedStudent }[] = [];
  let unchangedCount = 0;

  for (const inc of incomingStudents) {
    const key = inc.regNo.trim().toUpperCase();
    incomingMap.set(key, inc);

    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!;
      if (existing.name !== inc.name || existing.batch !== inc.batch) {
        toUpdate.push({ existing, updated: inc });
      } else {
        unchangedCount++;
      }
    } else {
      toAdd.push(inc);
    }
  }

  // Missing students: in DB but missing from the current incoming sheet
  const missing: StudentItem[] = [];
  for (const [key, existing] of existingMap.entries()) {
    if (!incomingMap.has(key)) {
      missing.push(existing);
    }
  }

  return {
    toAdd,
    toUpdate,
    missing,
    unchangedCount,
  };
}

export interface ExportOptions {
  classItem: ClassItem;
  labs: LabSessionItem[];
  students: StudentItem[];
  entries: EntryItem[];
  remarkScales: RemarkScaleItem[];
  includeSummary?: boolean;
  format?: 'xlsx' | 'csv';
}

export function generateExportWorkbook(options: ExportOptions): {
  blob: Blob;
  filename: string;
} {
  const { classItem, labs, students, entries, remarkScales, includeSummary = true, format = 'xlsx' } = options;

  // Build scale lookup map
  const scaleMap = new Map<string, { label: string; marks: number }>();
  for (const s of remarkScales) {
    scaleMap.set(s.key, { label: s.label, marks: s.marks });
  }

  // Build entry lookup map: key = `${labSessionId}_${studentId}`
  const entryMap = new Map<string, EntryItem>();
  for (const e of entries) {
    entryMap.set(`${e.labSessionId}_${e.studentId}`, e);
  }

  // Sheet "Marks"
  // Columns exactly: Name | Reg No | Lab No | Date Time | Remarks | Marks | Notes
  const marksHeader = ['Name', 'Reg No', 'Lab No', 'Date Time', 'Remarks', 'Marks', 'Notes'];
  const marksRows: any[][] = [marksHeader];

  // Sort labs by labNo ascending
  const sortedLabs = [...labs].sort((a, b) => a.labNo - b.labNo);
  // Sort students by serialNo ascending
  const sortedStudents = [...students].sort((a, b) => a.serialNo - b.serialNo);

  for (const lab of sortedLabs) {
    for (const student of sortedStudents) {
      const entryKey = `${lab.id}_${student.id}`;
      const entry = entryMap.get(entryKey);

      let remarks = '';
      let marks = 0;
      let dateTime = '';
      let notes = '';

      if (entry && entry.remarkKey) {
        const scale = scaleMap.get(entry.remarkKey);
        remarks = scale ? scale.label : entry.remarkKey;
        marks = scale ? scale.marks : 0;
        dateTime = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '';
        notes = entry.note || '';
      } else if (entry && entry.note) {
        notes = entry.note;
        dateTime = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : '';
      }

      marksRows.push([
        student.name,
        student.regNo,
        lab.labNo,
        dateTime,
        remarks,
        marks,
        notes,
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const marksWs = XLSX.utils.aoa_to_sheet(marksRows);
  XLSX.utils.book_append_sheet(wb, marksWs, 'Marks');

  // Optional second sheet "Summary"
  // Reg No, Name, one column of marks per lab, Total
  if (includeSummary && sortedLabs.length > 0) {
    const summaryHeader = ['Reg No', 'Name', ...sortedLabs.map((l) => `Lab ${l.labNo}`), 'Total'];
    const summaryRows: any[][] = [summaryHeader];

    for (const student of sortedStudents) {
      let totalMarks = 0;
      const labMarks = sortedLabs.map((lab) => {
        const entryKey = `${lab.id}_${student.id}`;
        const entry = entryMap.get(entryKey);
        if (entry && entry.remarkKey) {
          const scale = scaleMap.get(entry.remarkKey);
          const m = scale ? scale.marks : 0;
          totalMarks += m;
          return m;
        }
        return 0;
      });

      summaryRows.push([student.regNo, student.name, ...labMarks, totalMarks]);
    }

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
  }

  const sanitizedCourse = classItem.courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${sanitizedCourse}_Sec_${classItem.section || 'All'}_${dateStr}.${format}`;

  let outBlob: Blob;
  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(marksWs);
    outBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  } else {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    outBlob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  return { blob: outBlob, filename };
}

export async function shareOrDownloadFile(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Lab marks export: ${filename}`,
      });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false;
      }
      console.warn('Web Share failed, falling back to download:', err);
    }
  }

  // Fallback to standard download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
