'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  FlaskConical,
  Users,
  Search,
  Trash2,
  Edit2,
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { db } from '@/lib/db';
import { ClassItem, StudentItem, LabSessionItem } from '@/lib/types';
import { parseUniversityExcel, reconcileStudents, ReconciliationResult } from '@/lib/excel';

interface LabSessionWithProgress extends LabSessionItem {
  markedCount: number;
  totalStudents: number;
}

interface ClassDetailProps {
  classId: string;
  onBack: () => void;
  onOpenLab: (labSessionId: string) => void;
}

export function ClassDetail({ classId, onBack, onOpenLab }: ClassDetailProps) {
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [labs, setLabs] = useState<LabSessionWithProgress[]>([]);
  const [activeTab, setActiveTab] = useState<'labs' | 'students'>('labs');
  const [loading, setLoading] = useState<boolean>(true);

  // New Lab modal
  const [showNewLabModal, setShowNewLabModal] = useState<boolean>(false);
  const [newLabNo, setNewLabNo] = useState<number>(1);
  const [newLabDate, setNewLabDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Student Search
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Add / Edit student modal
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [stuSerialNo, setStuSerialNo] = useState<string>('');
  const [stuRegNo, setStuRegNo] = useState<string>('');
  const [stuName, setStuName] = useState<string>('');
  const [stuBatch, setStuBatch] = useState<string>('');

  // Delete student confirmation
  const [studentToDelete, setStudentToDelete] = useState<StudentItem | null>(null);

  // Delete lab confirmation
  const [labToDelete, setLabToDelete] = useState<LabSessionWithProgress | null>(null);

  // Reconcile Sheet update
  const [reconcileResult, setReconcileResult] = useState<ReconciliationResult | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const cls = await db.classes.get(classId);
      if (!cls) {
        onBack();
        return;
      }
      setClassItem(cls);

      const stuList = await db.students.where('classId').equals(classId).sortBy('serialNo');
      setStudents(stuList);

      const labList = await db.labSessions.where('classId').equals(classId).toArray();
      const labWithProgress: LabSessionWithProgress[] = await Promise.all(
        labList.map(async (lab) => {
          const entries = await db.entries.where('labSessionId').equals(lab.id).toArray();
          const markedCount = entries.filter((e) => e.remarkKey !== null && e.remarkKey !== '').length;
          return {
            ...lab,
            markedCount,
            totalStudents: stuList.length,
          };
        })
      );

      // Sort labs descending by labNo
      labWithProgress.sort((a, b) => b.labNo - a.labNo);
      setLabs(labWithProgress);

      // Determine next lab number
      const maxNo = labList.reduce((max, l) => Math.max(max, l.labNo), 0);
      setNewLabNo(maxNo + 1);
      setNewLabDate(new Date().toISOString().split('T')[0]);
    } catch (e) {
      console.error('Error loading class detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  const handleCreateLab = async () => {
    if (!newLabNo || isNaN(newLabNo)) {
      alert('Please enter a valid Lab Number');
      return;
    }

    const labSessionId = 'lab_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newSession: LabSessionItem = {
      id: labSessionId,
      classId,
      labNo: Number(newLabNo),
      date: newLabDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    try {
      await db.labSessions.add(newSession);
      setShowNewLabModal(false);
      onOpenLab(labSessionId);
    } catch (err: any) {
      alert('Error creating lab session: ' + err.message);
    }
  };

  const handleDeleteLab = async () => {
    if (!labToDelete) return;
    try {
      await db.transaction('rw', [db.labSessions, db.entries], async () => {
        await db.labSessions.delete(labToDelete.id);
        await db.entries.where('labSessionId').equals(labToDelete.id).delete();
      });
      setLabToDelete(null);
      await loadData();
    } catch (err: any) {
      alert('Error deleting lab: ' + err.message);
    }
  };

  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStuSerialNo(String(students.length + 1));
    setStuRegNo('');
    setStuName('');
    setStuBatch(students[0]?.batch || '');
    setShowStudentModal(true);
  };

  const handleOpenEditStudent = (s: StudentItem) => {
    setEditingStudent(s);
    setStuSerialNo(String(s.serialNo));
    setStuRegNo(s.regNo);
    setStuName(s.name);
    setStuBatch(s.batch || '');
    setShowStudentModal(true);
  };

  const handleSaveStudent = async () => {
    const trimmedReg = stuRegNo.trim();
    const trimmedName = stuName.trim().replace(/\s+/g, ' ');
    if (!trimmedReg || !trimmedName) {
      alert('Registration Number and Student Name are required.');
      return;
    }

    const sNo = Number(stuSerialNo) || (students.length + 1);

    try {
      if (editingStudent) {
        // Edit existing
        await db.students.update(editingStudent.id, {
          serialNo: sNo,
          regNo: trimmedReg,
          name: trimmedName,
          batch: stuBatch.trim(),
        });
      } else {
        // Check uniqueness in class
        const existing = await db.students
          .where('[classId+regNo]')
          .equals([classId, trimmedReg])
          .first();
        if (existing) {
          alert(`A student with Reg No "${trimmedReg}" already exists in this class.`);
          return;
        }

        const newStudent: StudentItem = {
          id: 'stu_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          classId,
          serialNo: sNo,
          regNo: trimmedReg,
          name: trimmedName,
          batch: stuBatch.trim(),
        };
        await db.students.add(newStudent);
      }

      setShowStudentModal(false);
      await loadData();
    } catch (err: any) {
      alert('Error saving student: ' + err.message);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await db.transaction('rw', [db.students, db.entries], async () => {
        await db.students.delete(studentToDelete.id);
        await db.entries.where('studentId').equals(studentToDelete.id).delete();
      });
      setStudentToDelete(null);
      await loadData();
    } catch (err: any) {
      alert('Error deleting student: ' + err.message);
    }
  };

  // Sheet Update / Re-import
  const handleSheetUpdateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseUniversityExcel(buffer);
      const result = reconcileStudents(students, parsed.students);
      setReconcileResult(result);
      setShowReconcileModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to parse Excel file for update.');
    } finally {
      e.target.value = '';
    }
  };

  const confirmReconcileUpdate = async () => {
    if (!reconcileResult) return;

    try {
      await db.transaction('rw', [db.students], async () => {
        // 1. Add new students
        if (reconcileResult.toAdd.length > 0) {
          const newItems: StudentItem[] = reconcileResult.toAdd.map((s, idx) => ({
            id: 'stu_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + '_' + idx,
            classId,
            serialNo: s.serialNo,
            regNo: s.regNo,
            name: s.name,
            batch: s.batch,
          }));
          await db.students.bulkAdd(newItems);
        }

        // 2. Update existing students
        for (const updateItem of reconcileResult.toUpdate) {
          await db.students.update(updateItem.existing.id, {
            name: updateItem.updated.name,
            batch: updateItem.updated.batch,
            serialNo: updateItem.updated.serialNo,
          });
        }
      });

      setShowReconcileModal(false);
      setReconcileResult(null);
      await loadData();
      alert('Class updated successfully! Missing students were kept untouched.');
    } catch (err: any) {
      alert('Error updating class from sheet: ' + err.message);
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q);
  });

  if (loading || !classItem) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-24 pt-3 px-4 max-w-md mx-auto w-full select-none">
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate leading-snug">
            {classItem.courseTitle}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {classItem.section && (
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                Sec {classItem.section}
              </span>
            )}
            {classItem.session && <span>{classItem.session}</span>}
            <span>•</span>
            <span>{students.length} students</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl mb-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('labs')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'labs'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Labs ({labs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'students'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students ({students.length})</span>
        </button>
      </div>

      {/* LABS TAB */}
      {activeTab === 'labs' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-700">Lab Sessions</h2>
            <button
              onClick={() => setShowNewLabModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New Lab
            </button>
          </div>

          {labs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs mt-2">
              <FlaskConical className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-slate-800">No lab sessions yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Tap &ldquo;New Lab&rdquo; to start marking viva for Lab 1.
              </p>
              <button
                onClick={() => setShowNewLabModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 bg-emerald-600 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Start Lab 1
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {labs.map((lab) => {
                const percent =
                  lab.totalStudents > 0
                    ? Math.round((lab.markedCount / lab.totalStudents) * 100)
                    : 0;
                return (
                  <div
                    key={lab.id}
                    onClick={() => onOpenLab(lab.id)}
                    className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 shadow-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base text-slate-900">
                          Lab {lab.labNo}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {lab.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              percent === 100 ? 'bg-emerald-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {lab.markedCount}/{lab.totalStudents} marked
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLabToDelete(lab);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl active:scale-95 transition-colors"
                        aria-label="Delete lab"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="space-y-3">
          {/* Action Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or reg no..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
            <button
              onClick={handleOpenAddStudent}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-3 rounded-xl shadow-xs flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 px-2.5 rounded-xl border border-slate-200 flex items-center gap-1 active:scale-95">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Update</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleSheetUpdateUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Student List */}
          <div className="space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No students match your search.
              </div>
            ) : (
              filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-center text-xs font-bold text-slate-400 shrink-0">
                      {s.serialNo}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {s.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {s.regNo} {s.batch && `• ${s.batch}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditStudent(s)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg active:scale-95"
                      aria-label="Edit student"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setStudentToDelete(s)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg active:scale-95"
                      aria-label="Delete student"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Lab Modal */}
      {showNewLabModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-600" />
              Start New Lab Session
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lab Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={newLabNo}
                  onChange={(e) => setNewLabNo(parseInt(e.target.value) || 1)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lab Date
                </label>
                <input
                  type="date"
                  value={newLabDate}
                  onChange={(e) => setNewLabDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewLabModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLab}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs"
              >
                Start Lab {newLabNo}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-3">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </h3>

            <div className="space-y-3 mb-5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Serial #
                  </label>
                  <input
                    type="number"
                    value={stuSerialNo}
                    onChange={(e) => setStuSerialNo(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Batch
                  </label>
                  <input
                    type="text"
                    value={stuBatch}
                    onChange={(e) => setStuBatch(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. B25F0061EE005"
                  value={stuRegNo}
                  onChange={(e) => setStuRegNo(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Raja Sheryar"
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudent}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Warning Modal (FR2: warns that student entries are deleted) */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Delete &ldquo;{studentToDelete.name}&rdquo;?
            </h3>
            <p className="text-xs text-rose-600 font-medium mt-1 leading-relaxed">
              Warning: Deleting this student will permanently erase all viva remarks recorded for them in all past lab sessions.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Lab Confirmation Modal */}
      {labToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Delete Lab {labToDelete.labNo}?
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              This will remove Lab {labToDelete.labNo} and all {labToDelete.markedCount} saved remarks for this session.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setLabToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLab}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs"
              >
                Delete Lab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconcile Update Modal (FR2: list students missing from the sheet for confirmation. Never auto-delete.) */}
      {showReconcileModal && reconcileResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Sync Class Roster
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600 mb-4">
              <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl">
                <strong>New students to add:</strong> {reconcileResult.toAdd.length}
              </div>
              <div className="bg-blue-50 text-blue-800 p-2.5 rounded-xl">
                <strong>Existing students updated:</strong> {reconcileResult.toUpdate.length}
              </div>
              <div className="bg-slate-100 text-slate-700 p-2.5 rounded-xl">
                <strong>Unchanged students:</strong> {reconcileResult.unchangedCount}
              </div>

              {reconcileResult.missing.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl mt-2">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Missing from sheet ({reconcileResult.missing.length})
                  </div>
                  <p className="text-[11px] text-amber-800 mb-2 leading-relaxed">
                    The following students were not in the updated Excel file. Per requirements, they will <strong>never be auto-deleted</strong> and will remain safely in the class.
                  </p>
                  <ul className="max-h-24 overflow-y-auto space-y-1 text-[11px] list-disc list-inside">
                    {reconcileResult.missing.map((m) => (
                      <li key={m.id}>
                        {m.name} ({m.regNo})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReconcileModal(false);
                  setReconcileResult(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReconcileUpdate}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs"
              >
                Apply Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
