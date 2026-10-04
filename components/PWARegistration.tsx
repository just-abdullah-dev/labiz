'use client';

import { useEffect } from 'react';
import { requestStoragePersistence } from '@/lib/storage';

export function PWARegistration() {
  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] ServiceWorker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.warn('[PWA] ServiceWorker registration failed:', error);
          });
      });
    }

    // 2. Request persistent storage on first launch (FR Non-functional requirement)
    requestStoragePersistence();
  }, []);

  return null;
}
