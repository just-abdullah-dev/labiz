'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  HardDrive,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db, getRemarkScales, setSetting, DEFAULT_REMARK_SCALES } from '@/lib/db';
import { RemarkScaleItem } from '@/lib/types';
import { createBackup, parseBackupFile, restoreBackup, resetAllData, getLastBackupInfo } from '@/lib/backup';
import { shareOrDownloadFile } from '@/lib/excel';
import { checkStoragePersistence, getStorageEstimate } from '@/lib/storage';
import { hashPin, verifyPin, generateSalt } from '@/lib/security';
import { getSetting } from '@/lib/db';

export function SettingsScreen() {
  const [remarkScales, setRemarkScales] = useState<RemarkScaleItem[]>([]);
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [storageInfo, setStorageInfo] = useState<{ isPersisted: boolean; usageMb: number }>({
    isPersisted: false,
    usageMb: 0,
  });

  // Change PIN modal
  const [showChangePin, setShowChangePin] = useState<boolean>(false);
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [pinChangeError, setPinChangeError] = useState<string>('');

  // Restore modal
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);

  // Reset modal
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  const [savedSuccess, setSavedSuccess] = useState<string>('');

  useEffect(() => {
    async function init() {
      const scales = await getRemarkScales();
      setRemarkScales(scales);

      const bInfo = await getLastBackupInfo();
      setBackupInfo(bInfo);

      const isPersisted = await checkStoragePersistence();
      const estimate = await getStorageEstimate();
      setStorageInfo({
        isPersisted,
        usageMb: Math.round((estimate.usage / (1024 * 1024)) * 100) / 100,
      });
    }
    init();
  }, []);

  const handleUpdateScale = (index: number, field: keyof RemarkScaleItem, value: any) => {
    const updated = [...remarkScales];
    updated[index] = { ...updated[index], [field]: value };
    setRemarkScales(updated);
  };

  const handleMoveScale = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === remarkScales.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...remarkScales];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setRemarkScales(updated);
  };

  const handleSaveScales = async () => {
    if (remarkScales.length < 6) {
      alert('You must keep at least 6 remark levels as per requirements.');
      return;
    }
    await setSetting('remarkScales', remarkScales);
    setSavedSuccess('Remark scale saved successfully!');
    setTimeout(() => setSavedSuccess(''), 4000);
  };

  const handleResetDefaultScales = async () => {
    setRemarkScales(DEFAULT_REMARK_SCALES);
    await setSetting('remarkScales', DEFAULT_REMARK_SCALES);
    setSavedSuccess('Reset to default remark scale.');
    setTimeout(() => setSavedSuccess(''), 4000);
  };

  const handleSaveNewPin = async () => {
    setPinChangeError('');
    if (newPinInput.length < 4 || newPinInput.length > 6) {
      setPinChangeError('New PIN must be between 4 and 6 digits.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeError('New PINs do not match.');
      return;
    }

    const currentHash = await getSetting<string>('pinHash');
    const currentSalt = await getSetting<string>('pinSalt');

    if (currentHash && currentSalt) {
      const valid = await verifyPin(currentPinInput, currentSalt, currentHash);
      if (!valid) {
        setPinChangeError('Current PIN is incorrect.');
        return;
      }
    }

    const newSalt = await generateSalt();
    const newHash = await hashPin(newPinInput, newSalt);
    await setSetting('pinSalt', newSalt);
    await setSetting('pinHash', newHash);

    setShowChangePin(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setSavedSuccess('PIN successfully updated!');
    setTimeout(() => setSavedSuccess(''), 4000);
  };

  const handleBackupNow = async () => {
    try {
      const { blob, filename } = await createBackup();
      await shareOrDownloadFile(blob, filename);
      const bInfo = await getLastBackupInfo();
      setBackupInfo(bInfo);
      setSavedSuccess('Backup created successfully!');
      setTimeout(() => setSavedSuccess(''), 4000);
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { backupData, summary } = await parseBackupFile(file);
      setPendingBackupData(backupData);
      setRestorePreview(summary);
      setShowRestoreModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to read backup file.');
    } finally {
      e.target.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!pendingBackupData) return;
    try {
      await restoreBackup(pendingBackupData);
      alert('Data restored successfully!');
      window.location.reload();
    } catch (err: any) {
      alert('Failed to restore backup: ' + err.message);
    }
  };

  const handleResetApp = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      alert('Please type RESET to confirm.');
      return;
    }
    await resetAllData();
    alert('App data wiped.');
    window.location.reload();
  };

  return (
    <div className="pb-28 pt-4 px-4 max-w-md mx-auto w-full select-none">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-xs text-slate-500">
          Remark scales, PIN security, backups & device storage
        </p>
      </div>

      {savedSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* SECTION 1: REMARK SCALES (FR7) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Remark Scale & Marks</h2>
            <p className="text-[11px] text-slate-500">
              Numbers remain hidden during marking and are only exported.
            </p>
          </div>
          <button
            onClick={handleResetDefaultScales}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline"
          >
            Reset Default
          </button>
        </div>

        <div className="space-y-2 mb-3">
          {remarkScales.map((scale, idx) => (
            <div
              key={scale.key}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/70"
            >
              <div
                className="w-4 h-8 rounded-md shrink-0"
                style={{ backgroundColor: scale.color }}
              />

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={scale.label}
                  onChange={(e) => handleUpdateScale(idx, 'label', e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-slate-400 font-semibold">Marks:</span>
                <input
                  type="number"
                  value={scale.marks}
                  onChange={(e) => handleUpdateScale(idx, 'marks', Number(e.target.value) || 0)}
                  className="w-12 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1 text-center"
                />
              </div>

              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveScale(idx, 'up')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === remarkScales.length - 1}
                  onClick={() => handleMoveScale(idx, 'down')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSaveScales}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all"
        >
          Save Remark Scale Changes
        </button>
      </div>

      {/* SECTION 2: SECURITY & PIN (FR1, FR7) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Security & PIN Lock</h2>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          PIN lock activates upon app launch and whenever the app has been in the background for over 5 minutes.
        </p>

        <button
          onClick={() => {
            setShowChangePin(true);
            setPinChangeError('');
          }}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 active:scale-95 transition-all text-center"
        >
          Change Security PIN
        </button>

        {/* Local privacy disclaimer required in Settings */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-slate-500 leading-tight">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Note: This is a local privacy lock to protect your marks while moving around the lab, not server-grade security.
          </span>
        </div>
      </div>

      {/* SECTION 3: BACKUP & RESTORE (FR6) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Backup & Restore</h2>

        <p className="text-[11px] text-slate-500">
          Last backup:{' '}
          <strong>
            {backupInfo?.daysAgo !== null && backupInfo?.daysAgo !== undefined
              ? backupInfo.daysAgo === 0
                ? 'Today'
                : `${backupInfo.daysAgo} days ago`
              : 'Never'}
          </strong>
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleBackupNow}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Backup Now
          </button>

          <label className="cursor-pointer py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center">
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            Restore (.json)
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* SECTION 4: STORAGE & HEALTH */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Device Storage Status</h2>
        </div>

        <div className="text-xs text-slate-600 flex justify-between py-1 border-b border-slate-100">
          <span>Persistent Storage:</span>
          <span className="font-bold text-emerald-700">
            {storageInfo.isPersisted ? 'Active (Protected)' : 'Standard'}
          </span>
        </div>

        <div className="text-xs text-slate-600 flex justify-between py-1">
          <span>Local IndexedDB Usage:</span>
          <span className="font-semibold text-slate-800">
            ~{storageInfo.usageMb > 0 ? storageInfo.usageMb : '< 1'} MB
          </span>
        </div>
      </div>

      {/* SECTION 5: DANGER ZONE - RESET APP */}
      <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 shadow-xs space-y-2">
        <h2 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Reset Application
        </h2>
        <p className="text-[11px] text-rose-700 leading-relaxed">
          Wipes all classes, students, lab sessions, entries, and settings from this browser.
        </p>

        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all"
        >
          Reset Application & Wipe Data
        </button>
      </div>

      {/* Change PIN Modal */}
      {showChangePin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              Change Security PIN
            </h3>

            {pinChangeError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg mb-3">
                {pinChangeError}
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 text-center tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  New 4-6 Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 text-center tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 text-center tracking-widest font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowChangePin(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewPin}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs"
              >
                Update PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Preview Modal */}
      {showRestoreModal && restorePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Restore Backup?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Restoring will replace all current data with this backup.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 my-4 text-xs space-y-1.5 text-slate-700 border border-slate-200">
              <div><strong>Exported:</strong> {new Date(restorePreview.exportedAt).toLocaleString()}</div>
              <div><strong>Classes:</strong> {restorePreview.classesCount}</div>
              <div><strong>Students:</strong> {restorePreview.studentsCount}</div>
              <div><strong>Lab Sessions:</strong> {restorePreview.labsCount}</div>
              <div><strong>Marked Entries:</strong> {restorePreview.entriesCount}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Reset Application?
            </h3>
            <p className="text-xs text-rose-600 font-medium mt-1">
              Warning: This will permanently delete ALL classes, students, labs, and marks stored locally.
            </p>
            <div className="my-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Type <strong>RESET</strong> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm uppercase tracking-wider"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                onClick={handleResetApp}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold text-white ${
                  resetConfirmText.trim().toUpperCase() === 'RESET'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                Erase All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
