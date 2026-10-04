import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWARegistration } from '@/components/PWARegistration';

export const metadata: Metadata = {
  title: 'Lab Viva Marker',
  description: 'Phone-first offline PWA for fast lab viva marking',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LabViva',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased bg-slate-100">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900 font-sans">
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
