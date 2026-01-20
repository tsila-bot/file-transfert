'use client';

import { useState } from 'react';
import HeaderPage from './shared/header/header';
import Sidebar from './shared/sidebar/sidebar';
import TransfertsPage from './transfert/page';

export default function DashboardPage({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header fixe en haut */}
      <HeaderPage
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      {/* Sidebar */}
      <Sidebar isSidebarOpen={isSidebarOpen} isDarkMode={isDarkMode} />

      {/* Main Content */}
      <main
        className={`flex-1 overflow-auto transition-all duration-300 ${
          isSidebarOpen ? 'ml-64' : 'ml-20'
        } mt-24`}
      >
        <TransfertsPage>{children}</TransfertsPage>
      </main>
    </div>
  );
}
