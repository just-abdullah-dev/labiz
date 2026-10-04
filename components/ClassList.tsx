'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  FileSpreadsheet,
  Users,
  FlaskConical,
  Trash2,
  Calendar,
  AlertCircle,
  Download,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { db, setSetting } from '@/lib/db';
import { ClassItem, StudentItem, LabSessionItem } from '@/lib/types';
import { parseUniversityExcel, ParsedClassData } from '@/lib/excel';
import { getLastBackupInfo, createBackup } from '@/lib/backup';
import { shareOrDownloadFile } from '@/lib/excel';

interface ClassWithStats extends ClassItem {
  studentCount: number;
  labCount: number;
}

interface ClassListProps {
  onSelectClass: (classId: string) => void;
  justFinishedLab?: boolean;
  onClearJustFinishedLab?: () => void;
}

export function ClassList({ onSelectClass, justFinishedLab, onClearJustFinishedLab }: ClassListProps) {
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backupInfo, setBackupInfo] = useState<{ daysAgo: number | null; dateStr: string | null; needsBackup: boolean }>({
    daysAgo: null,
    dateStr: null,
    needsBackup: false,
  });

  // Import modal state
  const [importing, setImporting] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<ParsedClassData | null>(null);
  const [showImportPreview, setShowImportPreview] = useState<boolean>(false);
  const [importCourseTitle, setImportCourseTitle] = useState<string>('');
  const [importSection, setImportSection] = useState<string>('');
  const [importSession, setImportSession] = useState<string>('');

  // Delete modal state
  const [classToDelete, setClassToDelete] = useState<ClassWithStats | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const allDraftClasses = await db.classes.toArray();
      const allStudents = await db.students.toArray();
      const allLabs = await db.labSessions.toArray();

      const enriched: ClassWithStats[] = allDraftClasses.map((cls) => {
        const studentCount = allStudents.filter((s) => s.classId === cls.id).length;
        const labCount = allLabs.filter((l) => l.classId === cls.id).length;
        return {
          ...cls,
          studentCount,
          labCount,
        };
      });

      // Sort by creation date or title
      enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setClasses(enriched);

      const bInfo = await getLastBackupInfo();
      setBackupInfo(bInfo);
    } catch (e) {
      console.error('Error loading classes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const buffer = await file.arrayBuffer();
      const result = parseUniversityExcel(buffer);

      setParsedData(result);
      setImportCourseTitle(result.courseTitle || 'New Course');
      setImportSection(result.section || '');
      setImportSession(result.session || '');
      setShowImportPreview(true);
    } catch (err: any) {
      alert(err.message || 'Failed to parse Excel file.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const confirmImport = async () => {
    if (!parsedData) return;

    const classId = 'cls_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newClass: ClassItem = {
      id: classId,
      courseTitle: importCourseTitle.trim() || 'Untitled Course',
      section: importSection.trim(),
      session: importSession.trim(),
      createdAt: new Date().toISOString(),
    };

    const studentItems: StudentItem[] = parsedData.students.map((s, idx) => ({
      id: 'stu_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
      classId,
      serialNo: s.serialNo || idx + 1,
      regNo: s.regNo,
      name: s.name,
      batch: s.batch,
    }));

    try {
      await db.transaction('rw', [db.classes, db.students], async () => {
        await db.classes.add(newClass);
        await db.students.bulkAdd(studentItems);
      });

      setShowImportPreview(false);
      setParsedData(null);
      await loadData();
      onSelectClass(classId);
    } catch (err: any) {
      alert('Error saving class: ' + err.message);
    }
  };

  const handleQuickBackup = async () => {
    try {
      const { blob, filename } = await createBackup();
      await shareOrDownloadFile(blob, filename);
      const bInfo = await getLastBackupInfo();
      setBackupInfo(bInfo);
      if (onClearJustFinishedLab) onClearJustFinishedLab();
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    }
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      const classId = classToDelete.id;
      const classLabs = await db.labSessions.where('classId').equals(classId).toArray();
      const labIds = classLabs.map((l) => l.id);

      await db.transaction('rw', [db.classes, db.students, db.labSessions, db.entries], async () => {
        await db.classes.delete(classId);
        await db.students.where('classId').equals(classId).delete();
        await db.labSessions.where('classId').equals(classId).delete();
        for (const lid of labIds) {
          await db.entries.where('labSessionId').equals(lid).delete();
        }
      });

      setClassToDelete(null);
      await loadData();
    } catch (err: any) {
      alert('Error deleting class: ' + err.message);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto w-full select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Classes</h1>
          <p className="text-xs text-slate-500">
            {backupInfo.daysAgo !== null
              ? `Last backup: ${backupInfo.daysAgo === 0 ? 'Today' : `${backupInfo.daysAgo}d ago`}`
              : 'Never backed up'}
          </p>
        </div>

        {/* Add Class Button via Excel */}
        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-3.5 rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95 transition-all">
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Class</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* Backup Reminder Banner (FR6: if over 7 days or after finishing a lab) */}
      {(backupInfo.needsBackup || justFinishedLab) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-900">
                {justFinishedLab ? 'Lab completed!' : 'Backup Recommended'}
              </p>
              <p className="text-[11px] text-amber-700 leading-tight">
                {justFinishedLab
                  ? 'Save your latest marks to backup JSON now.'
                  : `Last backup was ${backupInfo.daysAgo ?? 'over 7'} days ago.`}
              </p>
            </div>
          </div>
          <button
            onClick={handleQuickBackup}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Backup
          </button>
        </div>
      )}

      {/* Class List */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs mt-2">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No classes yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            Tap &ldquo;Add Class&rdquo; to import your university student list from an Excel file (<code>.xlsx</code>).
          </p>
          <label className="mt-4 inline-flex items-center gap-2 cursor-pointer bg-emerald-600 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-sm hover:bg-emerald-700 active:scale-95 transition-all">
            <FileSpreadsheet className="w-4 h-4" />
            Import University Sheet (.xlsx)
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <div
              key={cls.id}
              onClick={() => onSelectClass(cls.id)}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 shadow-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {cls.courseTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  {cls.section && (
                    <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
                      Sec {cls.section}
                    </span>
                  )}
                  {cls.session && (
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                      {cls.session}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {cls.studentCount} students
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
                    {cls.labCount} labs
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassToDelete(cls);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-xl active:scale-95 transition-colors"
                  aria-label="Delete class"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {showImportPreview && parsedData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <FileSpreadsheet className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-800">Confirm Class Import</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Successfully parsed university sheet with {parsedData.students.length} students.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={importCourseTitle}
                  onChange={(e) => setImportCourseTitle(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={importSection}
                    onChange={(e) => setImportSection(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Session
                  </label>
                  <input
                    type="text"
                    value={importSession}
                    onChange={(e) => setImportSession(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-medium"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600">
                <div className="flex justify-between font-medium">
                  <span>Detected Students:</span>
                  <span className="font-bold text-slate-900">{parsedData.students.length}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  First: {parsedData.students[0]?.name} ({parsedData.students[0]?.regNo})
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportPreview(false);
                  setParsedData(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm"
              >
                Import Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {classToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Delete &ldquo;{classToDelete.courseTitle}&rdquo;?
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This will permanently delete this class, its {classToDelete.studentCount} students, {classToDelete.labCount} labs, and all saved remarks.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteClass}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-sm"
              >
                Delete Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
