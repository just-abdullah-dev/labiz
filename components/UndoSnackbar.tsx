'use client';

import React from 'react';
import { RotateCcw, X } from 'lucide-react';

export interface UndoAction {
  id: string;
  studentName: string;
  previousRemarkKey: string | null;
  newRemarkKey: string | null;
  entryId: string;
  labSessionId: string;
  studentId: string;
  onUndo: () => void;
}

interface UndoSnackbarProps {
  action: UndoAction | null;
  onDismiss: () => void;
}

export function UndoSnackbar({ action, onDismiss }: UndoSnackbarProps) {
  if (!action) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 animate-slide-up pointer-events-auto">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-slate-700">
        <div className="text-sm truncate">
          <span className="font-medium text-slate-100">{action.studentName}</span>
          <span className="text-slate-300 ml-1.5">
            {action.newRemarkKey ? 'marked' : 'cleared'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              action.onUndo();
              onDismiss();
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg active:scale-95"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
