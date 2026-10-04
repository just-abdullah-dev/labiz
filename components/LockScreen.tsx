'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, KeyRound, AlertTriangle, RefreshCw, Upload, Delete, Check } from 'lucide-react';
import { hashPin, verifyPin, generateSalt } from '@/lib/security';
import { getSetting, setSetting } from '@/lib/db';
import { parseBackupFile, restoreBackup, resetAllData } from '@/lib/backup';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [pinSalt, setPinSalt] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [tempFirstPin, setTempFirstPin] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Restore & Reset Modals
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restorePreview, setRestorePreview] = useState<any>(null);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  useEffect(() => {
    async function loadPinConfig() {
      const storedHash = await getSetting<string>('pinHash');
      const storedSalt = await getSetting<string>('pinSalt');

      if (!storedHash || !storedSalt) {
        setIsSettingUp(true);
      } else {
        setPinHash(storedHash);
        setPinSalt(storedSalt);
      }
      setLoading(false);
    }
    loadPinConfig();
  }, []);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  const handleKeyPress = (num: string) => {
    triggerHaptic();
    if (pinInput.length < 6) {
      const next = pinInput + num;
      setPinInput(next);
      setErrorMsg('');

      // Auto-submit if 6 digits or allow submit button
      if (next.length >= 4 && !isSettingUp) {
        // We will verify when user taps Unlock or automatically if 6 digits
        if (next.length === 6) {
          verifyCandidate(next);
        }
      }
    }
  };

  const handleBackspace = () => {
    triggerHaptic();
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    triggerHaptic();
    setPinInput('');
    setErrorMsg('');
  };

  const verifyCandidate = async (candidatePin: string) => {
    if (!pinHash || !pinSalt) return;
    const isValid = await verifyPin(candidatePin, pinSalt, pinHash);
    if (isValid) {
      triggerHaptic();
      onUnlock();
    } else {
      setErrorMsg('Incorrect PIN. Please try again.');
      setPinInput('');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 50, 60]);
      }
    }
  };

  const handleUnlockClick = () => {
    if (pinInput.length < 4) {
      setErrorMsg('PIN must be at least 4 digits');
      return;
    }
    verifyCandidate(pinInput);
  };

  const handleSetupSubmit = async () => {
    if (pinInput.length < 4) {
      setErrorMsg('PIN must be 4 to 6 digits');
      return;
    }

    if (setupStep === 'create') {
      setTempFirstPin(pinInput);
      setPinInput('');
      setSetupStep('confirm');
      setErrorMsg('');
    } else {
      if (pinInput !== tempFirstPin) {
        setErrorMsg('PINs do not match. Try again.');
        setPinInput('');
        setSetupStep('create');
        setTempFirstPin('');
        return;
      }

      // Save salted hash
      const salt = await generateSalt();
      const hash = await hashPin(pinInput, salt);
      await setSetting('pinSalt', salt);
      await setSetting('pinHash', hash);
      setPinHash(hash);
      setPinSalt(salt);
      setIsSettingUp(false);
      onUnlock();
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
      alert('Data restored successfully! You can now access your classes.');
      setShowRestoreModal(false);
      // Reload app to refresh state
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
    alert('App data wiped. Starting fresh setup.');
    setShowResetConfirm(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto p-6 select-none">
      {/* Top Header */}
      <div className="pt-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-md mb-4">
          {isSettingUp ? <KeyRound className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          {isSettingUp
            ? setupStep === 'create'
              ? 'Set Security PIN'
              : 'Confirm Security PIN'
            : 'Lab Viva Marker'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isSettingUp
            ? setupStep === 'create'
              ? 'Choose a 4-6 digit PIN to protect your marks'
              : 'Re-enter your PIN to confirm'
            : 'Enter PIN to unlock'}
        </p>

        {/* PIN Dots Display */}
        <div className="flex justify-center items-center gap-3 mt-6 mb-2 h-8">
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const hasDigit = idx < pinInput.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  hasDigit
                    ? 'bg-emerald-600 border-emerald-600 scale-110'
                    : 'border-slate-300 bg-white'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div className="text-xs font-medium text-rose-600 mt-2 bg-rose-50 py-1.5 px-3 rounded-lg inline-block">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Numeric Keypad (min 56px height buttons) */}
      <div className="my-auto max-w-xs mx-auto w-full">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(String(num))}
              className="h-14 rounded-2xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm active:bg-slate-100 active:scale-95 transition-all flex items-center justify-center min-h-[56px]"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center min-h-[56px]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-sm active:bg-slate-100 active:scale-95 transition-all flex items-center justify-center min-h-[56px]"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center min-h-[56px]"
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>

        <div className="mt-4">
          {isSettingUp ? (
            <button
              type="button"
              disabled={pinInput.length < 4}
              onClick={handleSetupSubmit}
              className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                pinInput.length >= 4
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {setupStep === 'create' ? 'Continue' : 'Save PIN & Open'}
            </button>
          ) : (
            <button
              type="button"
              disabled={pinInput.length < 4}
              onClick={handleUnlockClick}
              className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                pinInput.length >= 4
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Unlock className="w-4 h-4" />
              Unlock App
            </button>
          )}
        </div>
      </div>

      {/* Forgot PIN & Emergency Recovery Path (FR1 Requirement) */}
      {!isSettingUp && (
        <div className="pb-4 pt-2 text-center border-t border-slate-200/80">
          <p className="text-xs text-slate-500 mb-3">
            Forgot PIN? Local data can be wiped, or restored from a previous JSON backup.
          </p>
          <div className="flex justify-center gap-4">
            <label className="cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Restore Backup
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 inline-flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Reset App
            </button>
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
              Restoring will replace all existing local data with this backup.
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

      {/* Reset App Confirmation Modal */}
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
              Warning: This will permanently delete ALL classes, students, lab sessions, and marks stored in this browser.
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
