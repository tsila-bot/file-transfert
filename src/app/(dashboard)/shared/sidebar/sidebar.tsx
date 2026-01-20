'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  FaHome,
  FaFileAlt,
  FaHistory,
  FaCog,
  FaUsers,
  FaChartBar,
  FaChevronDown,
} from 'react-icons/fa';
import { BiTransfer } from 'react-icons/bi';

interface SidebarProps {
  isSidebarOpen: boolean;
  isDarkMode: boolean;
}

export default function Sidebar({ isSidebarOpen, isDarkMode }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (item: string) => {
    setExpandedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: FaHome,
      href: '/dashboard',
    },
    {
      id: 'transfert',
      label: 'Transfert',
      icon: BiTransfer,
      href: '/dashboard/transfert',
    },
    {
      id: 'fichiers',
      label: 'Mes Fichiers',
      icon: FaFileAlt,
      href: '/dashboard/files',
      submenu: [
        { label: 'Récents', href: '/dashboard/files/recent' },
        { label: 'Partagés', href: '/dashboard/files/shared' },
        { label: 'Archivés', href: '/dashboard/files/archived' },
      ],
    },
    {
      id: 'historique',
      label: 'Historique',
      icon: FaHistory,
      href: '/dashboard/history',
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: FaUsers,
      href: '/dashboard/contacts',
    },
    {
      id: 'statistiques',
      label: 'Statistiques',
      icon: FaChartBar,
      href: '/dashboard/stats',
    },
    // {
    //   id: 'aide',
    //   label: 'Aide & Support',
    //   icon: FaHelpCircle,
    //   href: '/dashboard/help',
    // },
    {
      id: 'parametres',
      label: 'Paramètres',
      icon: FaCog,
      href: '/dashboard/settings',
    },
  ];

  return (
    <div
      className={`fixed left-0 top-24 h-[calc(100vh-6rem)] transition-all duration-300 ${
        isSidebarOpen ? 'w-64' : 'w-20'
      } ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r shadow-lg`}
    >
      <nav className="h-full overflow-y-auto p-4 space-y-2 mt-10">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isExpanded = expandedItems.includes(item.id);

          return (
            <div key={item.id}>
              {hasSubmenu ? (
                <button
                  onClick={() => toggleExpand(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition ${
                    isDarkMode
                      ? 'hover:bg-gray-700 text-gray-200'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-indigo-500 flex-shrink-0" />
                    {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                  </div>
                  {isSidebarOpen && (
                    <FaChevronDown
                      size={16}
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isDarkMode
                      ? 'hover:bg-gray-700 text-gray-200'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  title={!isSidebarOpen ? item.label : ''}
                >
                  <Icon size={20} className="text-indigo-500 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              )}

              {/* Submenu */}
              {hasSubmenu && isExpanded && isSidebarOpen && (
                <div className={`ml-4 space-y-1 mt-1 border-l-2 border-indigo-500 pl-2`}>
                  {item.submenu.map((subitem) => (
                    <Link
                      key={subitem.href}
                      href={subitem.href}
                      className={`block px-4 py-2 rounded-lg text-sm transition ${
                        isDarkMode
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {subitem.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
