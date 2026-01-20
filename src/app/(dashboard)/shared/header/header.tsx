'use client';

import { useState, useRef } from 'react';
import { BiTransfer } from 'react-icons/bi';
import {
  FaCog,
  FaEnvelope,
  FaUser,
  FaClock,
  FaPalette,
  FaSignOutAlt,
  FaBars,
  FaTimes,
} from 'react-icons/fa';
import { MdNotifications, MdDarkMode } from 'react-icons/md';

interface HeaderPageProps {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (value: boolean) => void;
}

export default function HeaderPage({
  isDarkMode,
  setIsDarkMode,
  isSidebarOpen,
  setIsSidebarOpen,
}: HeaderPageProps) {
  const [messageCount, setMessageCount] = useState<number>(3);
  const [notificationCount, setNotificationCount] = useState<number>(5);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const profileRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } border-b shadow-md`}
    >
      <div className="px-6 py-3 flex items-center justify-between h-24">
        {/* Logo et Toggle Sidebar */}
        <div className="flex items-center justify-between w-56">
          <img src="/assets/images/logo/logo.png" alt="Logo" className="w-20 h-16" />
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg cursor-pointer text-indigo-500 hover:bg-gray-200 ${isDarkMode ? 'hover:bg-indigo-500' : ''}`}
          >
            {isSidebarOpen ? <FaBars size={30} /> : <FaTimes size={20} />}
          </button>
        </div>

        {/* Icons de droite */}
        <div className="flex items-center justify-center gap-5">
          {/* Messages */}
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-gray-100 transition">
            <FaEnvelope size={30} className="text-indigo-500" />
            {messageCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {messageCount > 99 ? '99+' : messageCount}
              </span>
            )}
          </div>

          {/* Notifications */}
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-gray-100 transition">
            <MdNotifications size={30} className="text-indigo-500" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>

          {/* Transfert */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-gray-100 transition">
            <BiTransfer size={30} className="text-indigo-500" />
          </div>

          {/* Mode Sombre */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer hover:bg-gray-100 transition"
          >
            <MdDarkMode size={30} className={isDarkMode ? 'text-yellow-400' : 'text-indigo-500'} />
          </button>

          {/* Profil */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-center w-12 h-12 rounded-full cursor-pointer hover:ring-2 hover:ring-indigo-500 transition"
            >
              <img
                src="/assets/images/th-1/RLR .jpg"
                className="w-12 h-12 rounded-full"
                alt="Profil"
              />
            </button>

            {/* Menu déroulant du profil */}
            {isProfileOpen && (
              <div
                className={`absolute right-0 mt-2 w-80 rounded-lg shadow-2xl border z-50 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                {/* En-tête du profil */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <img
                      src="/assets/images/th-1/RLR .jpg"
                      className="w-16 h-16 rounded-full border-4 border-white"
                      alt="Profil"
                    />
                    <div>
                      <h3 className="text-white font-bold text-lg">Utilisateur</h3>
                      <p className="text-indigo-100 text-sm">utilisateur@email.com</p>
                    </div>
                  </div>
                </div>

                {/* Séparateur */}
                <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                {/* Menu items */}
                <div className="p-3 space-y-1">
                  {/* Mon Profil */}
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <FaUser size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Mon Profil</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Voir et éditer votre profil
                      </p>
                    </div>
                  </button>

                  {/* Paramètres */}
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <FaCog size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Paramètres</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Gérer vos préférences
                      </p>
                    </div>
                  </button>

                  {/* Activité */}
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <FaClock size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Activité</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Historique de connexion
                      </p>
                    </div>
                  </button>

                  {/* Apparence */}
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <FaPalette size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Apparence</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Personnaliser l'interface
                      </p>
                    </div>
                  </button>
                </div>

                {/* Séparateur */}
                <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                {/* Déconnexion */}
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-b-lg font-semibold transition ${
                    isDarkMode ? 'hover:bg-red-900 text-red-400' : 'hover:bg-red-50 text-red-600'
                  }`}
                >
                  <FaSignOutAlt size={18} />
                  <span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
