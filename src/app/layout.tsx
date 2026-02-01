import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import MobileBottomNav from './components/MobileBottomNav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Local Deals',
  description: 'Discover premium local deals near you',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-20`}
      >
        {/* Desktop Navbar */}
        <Navbar />

        {/* Page Content */}
        <main className="app-container">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <MobileBottomNav />
      </body>
    </html>
  );
}
