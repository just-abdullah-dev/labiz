'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LockScreen } from '@/components/LockScreen';
import { ClassList } from '@/components/ClassList';
import { ClassDetail } from '@/components/ClassDetail';
import { MarkingScreen } from '@/components/MarkingScreen';
import { ExportScreen } from '@/components/ExportScreen';
import { SettingsScreen } from '@/components/SettingsScreen';
import { BottomNav, NavTab } from '@/components/BottomNav';
import { UndoSnackbar, UndoAction } from '@/components/UndoSnackbar';

export default function Home() {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('classes');
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [justFinishedLab, setJustFinishedLab] = useState<boolean>(false);

  // Background inactivity tracking (FR1: lock after 5 minutes in background)
  const lastHiddenTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (lastHiddenTimeRef.current) {
          const elapsed = Date.now() - lastHiddenTimeRef.current;
          const FIVE_MINUTES_MS = 5 * 60 * 1000;
          if (elapsed >= FIVE_MINUTES_MS) {
            setIsLocked(true);
          }
        }
        lastHiddenTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 5-second automatic dismiss for Undo snackbar (FR4)
  useEffect(() => {
    if (!undoAction) return;
    const timer = setTimeout(() => {
      setUndoAction(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [undoAction]);

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />;
  }

  // Active Marking Screen takes full focus (back button returns to class)
  if (activeLabId) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <MarkingScreen
          labSessionId={activeLabId}
          onBack={() => setActiveLabId(null)}
          onUndoActionChange={(action) => setUndoAction(action)}
          onLabFinished={() => setJustFinishedLab(true)}
        />
        <UndoSnackbar
          action={undoAction}
          onDismiss={() => setUndoAction(null)}
        />
      </div>
    );
  }

  // Active Class Detail (Labs list & Students management)
  if (activeClassId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <ClassDetail
          classId={activeClassId}
          onBack={() => setActiveClassId(null)}
          onOpenLab={(labId) => setActiveLabId(labId)}
        />
        <BottomNav
          currentTab={currentTab}
          onTabChange={(tab) => {
            setActiveClassId(null);
            setCurrentTab(tab);
          }}
        />
        <UndoSnackbar
          action={undoAction}
          onDismiss={() => setUndoAction(null)}
        />
      </div>
    );
  }

  // Tab views
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {currentTab === 'classes' && (
        <ClassList
          onSelectClass={(classId) => setActiveClassId(classId)}
          justFinishedLab={justFinishedLab}
          onClearJustFinishedLab={() => setJustFinishedLab(false)}
        />
      )}
      {currentTab === 'export' && <ExportScreen />}
      {currentTab === 'settings' && <SettingsScreen />}

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setActiveClassId(null);
          setCurrentTab(tab);
        }}
      />
      <UndoSnackbar
        action={undoAction}
        onDismiss={() => setUndoAction(null)}
      />
    </div>
  );
}
