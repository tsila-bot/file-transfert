'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  MessageCircle,
  Phone,
  Users,
  Share2,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Link2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },

  { icon: Users, label: 'Groupes', href: '/teams' },
  { icon: Share2, label: 'Transferts', href: '/transfert' },
  { icon: Link2, label: 'Liens Publics', href: '/liens-publics' },
  { icon: FileText, label: 'Contacts', href: '/contacts' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed md:hidden top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky left-0 top-0 h-screen w-64 bg-[#1a1d2e] border-r border-gray-800 flex flex-col transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Share2 size={20} className="text-white" />
            </div>
            <span>Webdevin</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">P2P Transfer & Chat</p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
                {active && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-gray-800 p-4 space-y-2">
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              isActive('/profile')
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <Settings size={20} />
            <span>Paramètres</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-red-900/20 hover:text-red-400 transition-all duration-200"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed md:hidden inset-0 bg-black/50 z-30 mt-16"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
