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
        <meta name="theme-color" content="#020617" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased pb-24 bg-slate-950`}>
        {/* Aurora background — fixed, behind everything */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute -top-48 -left-48 h-[500px] w-[500px] rounded-full bg-violet-600/[0.12] blur-[120px] animate-aurora-1"
          />
          <div
            className="absolute -top-24 right-[-100px] h-[400px] w-[400px] rounded-full bg-fuchsia-600/[0.09] blur-[100px] animate-aurora-2"
          />
          <div
            className="absolute bottom-0 -left-32 h-[350px] w-[350px] rounded-full bg-indigo-600/[0.08] blur-[100px]"
          />
          <div
            className="absolute bottom-40 right-8 h-[280px] w-[280px] rounded-full bg-cyan-500/[0.06] blur-[80px]"
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
