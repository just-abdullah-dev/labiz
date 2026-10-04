'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Share2,
  Download,
  CheckCircle,
  FlaskConical,
  GraduationCap,
} from 'lucide-react';
import { db, getRemarkScales } from '@/lib/db';
import { ClassItem, LabSessionItem } from '@/lib/types';
import { generateExportWorkbook, shareOrDownloadFile } from '@/lib/excel';

export function ExportScreen() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [labs, setLabs] = useState<LabSessionItem[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('all');
  const [includeSummary, setIncludeSummary] = useState<boolean>(true);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const all = await db.classes.toArray();
        setClasses(all);
        if (all.length > 0) {
          setSelectedClassId(all[0].id);
        }
      } catch (err) {
        console.error('Error loading export classes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    async function loadLabs() {
      if (!selectedClassId) {
        setLabs([]);
        return;
      }
      const classLabs = await db.labSessions
        .where('classId')
        .equals(selectedClassId)
        .sortBy('labNo');
      setLabs(classLabs);
      setSelectedLabId('all');
    }
    loadLabs();
  }, [selectedClassId]);

  const handleExport = async () => {
    if (!selectedClassId) return;

    try {
      setExporting(true);
      setSuccessMessage('');

      const classItem = await db.classes.get(selectedClassId);
      if (!classItem) return;

      const students = await db.students
        .where('classId')
        .equals(selectedClassId)
        .sortBy('serialNo');

      let exportLabs: LabSessionItem[] = [];
      if (selectedLabId === 'all') {
        exportLabs = labs;
      } else {
        const single = labs.find((l) => l.id === selectedLabId);
        if (single) exportLabs = [single];
      }

      // Fetch entries for these labs
      const labIds = exportLabs.map((l) => l.id);
      const allEntries = await db.entries.toArray();
      const filteredEntries = allEntries.filter((e) => labIds.includes(e.labSessionId));

      const remarkScales = await getRemarkScales();

      const { blob, filename } = generateExportWorkbook({
        classItem,
        labs: exportLabs,
        students,
        entries: filteredEntries,
        remarkScales,
        includeSummary: format === 'xlsx' ? includeSummary : false,
        format,
      });

      const shared = await shareOrDownloadFile(blob, filename);
      setSuccessMessage(
        shared ? `Exported ${filename} successfully!` : 'File download initiated.'
      );
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="p-6 max-w-md mx-auto text-center select-none pt-16">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">No classes to export</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Add or import a class from the Classes tab first to mark and export viva records.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto w-full select-none">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Export Marks</h1>
        <p className="text-xs text-slate-500">
          Generate official grading sheets in Excel or CSV format
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Select Class */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            Select Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.courseTitle} {cls.section ? `(Sec ${cls.section})` : ''} - {cls.session}
              </option>
            ))}
          </select>
        </div>

        {/* Select Labs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            Lab Session Scope
          </label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:border-emerald-600 focus:outline-hidden"
          >
            <option value="all">All Labs ({labs.length} sessions)</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                Lab {l.labNo} ({l.date})
              </option>
            ))}
          </select>
        </div>

        {/* Format Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            File Format
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('xlsx')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                format === 'xlsx'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                format === 'csv'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              CSV (.csv)
            </button>
          </div>
        </div>

        {/* Summary Sheet Option (Excel only) */}
        {format === 'xlsx' && (
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 border-slate-300"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800">Include &ldquo;Summary&rdquo; sheet</span>
              <p className="text-[11px] text-slate-500">
                Adds a second sheet with all lab marks side-by-side and Total.
              </p>
            </div>
          </label>
        )}

        {/* Columns Guarantee Spec Info Box */}
        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
          <div className="font-semibold text-slate-700">Official Columns Guaranteed:</div>
          <code className="text-[10px] text-emerald-800 block">
            Name | Reg No | Lab No | Date Time | Remarks | Marks | Notes
          </code>
          <div className="text-[10px] text-slate-400">
            Unmarked students export with blank remarks and Marks: 0.
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {exporting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span>Share or Download Export</span>
            </>
          )}
        </button>

        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
