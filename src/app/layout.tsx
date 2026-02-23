import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';
import ServiceWorkerRegistrar from './components/Serviceworkerregistrar';


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
    statusBarStyle: 'default',
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
        {/* PWA essentials */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LocalDeals" />
        <meta name="theme-color" content="#7c3aed" />

        {/* Apple touch icon - point to your 192 icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-20`}
      ><ServiceWorkerRegistrar />
        <Navbar />
        <main className="app-container">{children}</main>
        <MobileBottomNav />
      </body>
    </html>
  );
}