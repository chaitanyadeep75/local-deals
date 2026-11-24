import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import ServiceWorkerRegistrar from './components/Serviceworkerregistrar';
import PWAInstallPrompt from './components/PWAInstallPrompt';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LocalDeals – Discover Amazing Local Deals',
  description: 'Discover premium local deals near you',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LocalDeals',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: 'LocalDeals',
    description: 'Discover amazing local deals near you',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LocalDeals" />
        <meta name="theme-color" content="#0a100e" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased pb-24 bg-slate-950`}>
        {/* Subtle ambient color keeps content in focus. */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute -top-48 -left-48 h-[500px] w-[500px] rounded-full bg-emerald-700/[0.08] blur-[140px]"
          />
          <div
            className="absolute -top-24 right-[-100px] h-[400px] w-[400px] rounded-full bg-teal-700/[0.06] blur-[130px]"
          />
          <div
            className="absolute bottom-0 -left-32 h-[350px] w-[350px] rounded-full bg-emerald-900/[0.08] blur-[120px]"
          />
          <div
            className="absolute bottom-40 right-8 h-[280px] w-[280px] rounded-full bg-amber-700/[0.035] blur-[100px]"
          />
        </div>

        <ServiceWorkerRegistrar />
        <PWAInstallPrompt />
        <Navbar />
        <main className="app-container" style={{ position: 'relative', zIndex: 1 }}>{children}</main>
        <MobileBottomNav />
      </body>
    </html>
  );
}
