'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  FileText,
  CheckCircle2,
  Circle,
  RotateCcw,
} from 'lucide-react';
import { db, getRemarkScales } from '@/lib/db';
import { ClassItem, StudentItem, LabSessionItem, EntryItem, RemarkScaleItem } from '@/lib/types';
import { UndoAction } from './UndoSnackbar';

interface MarkingScreenProps {
  labSessionId: string;
  onBack: () => void;
  onUndoActionChange: (action: UndoAction | null) => void;
  onLabFinished?: () => void;
}

export function MarkingScreen({
  labSessionId,
  onBack,
  onUndoActionChange,
  onLabFinished,
}: MarkingScreenProps) {
  const [lab, setLab] = useState<LabSessionItem | null>(null);
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [entries, setEntries] = useState<Map<string, EntryItem>>(new Map());
  const [remarkScales, setRemarkScales] = useState<RemarkScaleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'unmarked' | 'marked'>('all');

  // Expanded row for 2x3 grid
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Note editing per student
  const [activeNoteStudentId, setActiveNoteStudentId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string>('');

  // Refs for auto-scroll
  const rowRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const currentLab = await db.labSessions.get(labSessionId);
        if (!currentLab) {
          onBack();
          return;
        }
        setLab(currentLab);

        const currentClass = await db.classes.get(currentLab.classId);
        setClassItem(currentClass || null);

        const classStudents = await db.students
          .where('classId')
          .equals(currentLab.classId)
          .sortBy('serialNo');
        setStudents(classStudents);

        const labEntries = await db.entries.where('labSessionId').equals(labSessionId).toArray();
        const map = new Map<string, EntryItem>();
        for (const e of labEntries) {
          map.set(e.studentId, e);
        }
        setEntries(map);

        const scales = await getRemarkScales();
        setRemarkScales(scales);
      } catch (err) {
        console.error('Error loading marking screen:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [labSessionId]);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35);
    }
  };

  const handleSelectRemark = async (student: StudentItem, scaleKey: string) => {
    triggerHaptic();

    const existingEntry = entries.get(student.id);
    const previousRemark = existingEntry?.remarkKey || null;
    const isClearing = previousRemark === scaleKey;
    const newRemark = isClearing ? null : scaleKey;

    const entryId = existingEntry?.id || 'ent_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const nowIso = new Date().toISOString();

    const updatedEntry: EntryItem = {
      id: entryId,
      labSessionId,
      studentId: student.id,
      remarkKey: newRemark,
      note: existingEntry?.note || null,
      updatedAt: nowIso,
    };

    // 1. INSTANT Dexie write (before UI animation finishes)
    if (newRemark === null && !updatedEntry.note) {
      // If cleared and no note, we can delete the entry or set remarkKey to null
      await db.entries.put(updatedEntry);
    } else {
      await db.entries.put(updatedEntry);
    }

    // 2. Update local state immediately
    const nextMap = new Map(entries);
    nextMap.set(student.id, updatedEntry);
    setEntries(nextMap);

    // 3. Collapse current row
    setExpandedStudentId(null);

    // 4. Setup 5-second Undo action
    onUndoActionChange({
      id: Date.now().toString(),
      studentName: student.name,
      previousRemarkKey: previousRemark,
      newRemarkKey: newRemark,
      entryId: updatedEntry.id,
      labSessionId,
      studentId: student.id,
      onUndo: async () => {
        const reverted: EntryItem = {
          ...updatedEntry,
          remarkKey: previousRemark,
          updatedAt: new Date().toISOString(),
        };
        await db.entries.put(reverted);
        setEntries((prev) => {
          const m = new Map(prev);
          m.set(student.id, reverted);
          return m;
        });
      },
    });

    // 5. Auto-scroll to next unmarked student if we marked someone
    if (!isClearing) {
      const currentIndex = students.findIndex((s) => s.id === student.id);
      // Search forward
      let nextUnmarked: StudentItem | undefined;
      for (let i = currentIndex + 1; i < students.length; i++) {
        const s = students[i];
        const ent = nextMap.get(s.id);
        if (!ent || !ent.remarkKey) {
          nextUnmarked = s;
          break;
        }
      }
      // If not found forward, search from beginning
      if (!nextUnmarked) {
        for (let i = 0; i < currentIndex; i++) {
          const s = students[i];
          const ent = nextMap.get(s.id);
          if (!ent || !ent.remarkKey) {
            nextUnmarked = s;
            break;
          }
        }
      }

      if (nextUnmarked && rowRefs.current[nextUnmarked.id]) {
        setTimeout(() => {
          rowRefs.current[nextUnmarked!.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 120);
      } else if (!nextUnmarked) {
        // All students marked!
        if (onLabFinished) onLabFinished();
      }
    }
  };

  const handleRowClick = (studentId: string) => {
    triggerHaptic();
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const handleOpenNote = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    const existing = entries.get(studentId);
    setNoteText(existing?.note || '');
    setActiveNoteStudentId(studentId);
  };

  const handleSaveNote = async () => {
    if (!activeNoteStudentId) return;

    const existing = entries.get(activeNoteStudentId);
    const entryId = existing?.id || 'ent_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const updated: EntryItem = {
      id: entryId,
      labSessionId,
      studentId: activeNoteStudentId,
      remarkKey: existing?.remarkKey || null,
      note: noteText.trim() || null,
      updatedAt: new Date().toISOString(),
    };

    await db.entries.put(updated);
    setEntries((prev) => {
      const m = new Map(prev);
      m.set(activeNoteStudentId, updated);
      return m;
    });

    setActiveNoteStudentId(null);
    setNoteText('');
  };

  if (loading || !lab || !classItem) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Count progress
  const markedCount = students.filter((s) => {
    const e = entries.get(s.id);
    return e && e.remarkKey;
  }).length;
  const totalCount = students.length;
  const progressPercent = totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;

  // Filter students
  const filteredStudents = students.filter((s) => {
    // 1. Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchName = s.name.toLowerCase().includes(q);
      const matchReg = s.regNo.toLowerCase().includes(q);
      if (!matchName && !matchReg) return false;
    }

    // 2. Chip filter
    const entry = entries.get(s.id);
    const isMarked = entry && entry.remarkKey;
    if (filterType === 'marked' && !isMarked) return false;
    if (filterType === 'unmarked' && isMarked) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none max-w-md mx-auto w-full pb-28">
      {/* Sticky Top Bar (FR4 Core Requirement) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs pt-safe">
        {/* Row 1: Back + Lab Header */}
        <div className="px-3 py-2 flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-xl active:scale-95 transition-all"
            aria-label="Back to class"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 truncate">
              <span>{classItem.courseTitle}</span>
              {classItem.section && (
                <span className="bg-emerald-50 text-emerald-800 text-[11px] px-1.5 py-0.2 rounded font-semibold">
                  Sec {classItem.section}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Lab {lab.labNo} • {lab.date}
            </div>
          </div>

          {/* Progress Badge */}
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-slate-800">
              {markedCount}/{totalCount}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold">
              {progressPercent}% marked
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-emerald-600 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Row 2: Search Input */}
        <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or reg no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:border-emerald-500 focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Filter Chips (All / Unmarked / Marked) */}
        <div className="px-3 pb-2 flex gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('unmarked')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterType === 'unmarked'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Unmarked ({totalCount - markedCount})
          </button>
          <button
            onClick={() => setFilterType('marked')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterType === 'marked'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Marked ({markedCount})
          </button>
        </div>
      </header>

      {/* Student List */}
      <main className="p-3 space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No students found.
          </div>
        ) : (
          filteredStudents.map((student) => {
            const entry = entries.get(student.id);
            const isMarked = Boolean(entry && entry.remarkKey);
            const isExpanded = expandedStudentId === student.id;
            const currentScale = remarkScales.find((s) => s.key === entry?.remarkKey);

            return (
              <div
                key={student.id}
                ref={(el) => {
                  rowRefs.current[student.id] = el;
                }}
                className={`bg-white rounded-2xl border transition-all duration-150 overflow-hidden shadow-xs ${
                  isExpanded
                    ? 'border-emerald-500 ring-2 ring-emerald-100'
                    : isMarked
                    ? 'border-slate-200'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Main Student Row (Tap to expand) */}
                <div
                  onClick={() => handleRowClick(student.id)}
                  className="p-3.5 flex items-center justify-between gap-2.5 cursor-pointer active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center text-xs font-bold text-slate-400 shrink-0">
                      {student.serialNo}
                    </span>

                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">
                        {student.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {student.regNo}
                        {entry?.note && (
                          <span className="ml-2 text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-sans text-[10px]">
                            &ldquo;{entry.note}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Remark Badge & Note icon */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Note Icon */}
                    <button
                      onClick={(e) => handleOpenNote(e, student.id)}
                      className={`p-1.5 rounded-lg active:scale-95 transition-colors ${
                        entry?.note
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-slate-300 hover:text-slate-500'
                      }`}
                      aria-label="Add Note"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* Colored Remark Badge (Text + Color, no numbers shown) */}
                    {isMarked && currentScale ? (
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs select-none"
                        style={{
                          backgroundColor: currentScale.color,
                          color: currentScale.textColor,
                        }}
                      >
                        {currentScale.label}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                        Tap to mark
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline 2x3 Grid of Large Remark Buttons (FR4: min 56px height, coloured, label only) */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/80 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {remarkScales.map((scale) => {
                        const isCurrentActive = entry?.remarkKey === scale.key;
                        return (
                          <button
                            key={scale.key}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRemark(student, scale.key);
                            }}
                            className={`min-h-[56px] rounded-xl font-bold text-sm tracking-wide shadow-xs active:scale-95 transition-all flex items-center justify-center px-2 select-none ${
                              isCurrentActive
                                ? 'ring-3 ring-offset-1 ring-slate-900 font-extrabold'
                                : ''
                            }`}
                            style={{
                              backgroundColor: scale.color,
                              color: scale.textColor,
                            }}
                          >
                            <span>{scale.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Note Edit Modal (FR4: small note icon per row opens one-line text field) */}
      {activeNoteStudentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Add Student Note
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Notes are secondary and export to Excel alongside remarks.
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Needs viva re-check on lab 2"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote();
              }}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 mb-4 focus:border-emerald-600 focus:outline-hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveNoteStudentId(null);
                  setNoteText('');
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
