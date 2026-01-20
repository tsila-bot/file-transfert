
'use client';

import { PeerManager } from '@/components/peers/PeerManager';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Header */}
        <Header />

        {/* Peer Manager (invisible) */}
        <PeerManager />

        {/* Page Content */}
        <main className="flex-1 overflow-auto mt-20">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}