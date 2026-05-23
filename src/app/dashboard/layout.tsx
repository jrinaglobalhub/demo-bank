import React from 'react';
import Sidebar from '@/components/Sidebar';
import TopBanner from '@/components/TopBanner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-zinc-950">
      {/* Dynamic Navigation Sidebar */}
      <Sidebar />

      {/* Main Operations Frame */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Banner with Greeting, Role details, and DB Engine Indicators */}
        <TopBanner />

        {/* Dynamic page container */}
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
