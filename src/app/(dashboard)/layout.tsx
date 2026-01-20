'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, File, X, Check, AlertCircle, Cloud, Loader } from 'lucide-react';
import { PeerManager } from '@/components/peers/PeerManager';
import { PeerList } from '@/components/peers/PeerList';
import { BiTransfer } from 'react-icons/bi';
import { FaCog, FaEnvelope, FaUser, FaClock, FaPalette, FaSignOutAlt } from 'react-icons/fa';
import { MdNotifications, MdDarkMode } from 'react-icons/md';

export default function DashboardPage({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState<number>(3);
  const [notificationCount, setNotificationCount] = useState<number>(5);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-6 pt-24">
      {' '}
      {/* Augmenté le padding-top pour le header fixe */}
      {/* Gestionnaire de peers (invisible) */}
      <PeerManager />
      {/* Header fixe avec z-10 */}
      <div className="fixed top-0 left-0 right-0 bg-white z-10 px-6 py-2 shadow flex items-center justify-between">
        <div className="flex items-center w-auto h-full">
          <img src="/assets/images/logo/logo.png" alt="Image standard" className="w-24 h-[70px]" />
        </div>
        <div className="flex items-center justify-center gap-5">
          <div className="relative flex pt-2 items-center justify-center gap-2 w-[60px] h-[60px] rounded-full cursor-pointer">
            <FaEnvelope size={28} className="text-indigo-500 mb-2" />
            {messageCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {messageCount > 99 ? '99+' : messageCount}
              </span>
            )}
          </div>
          <div className="relative flex pt-2 items-center justify-center gap-2 w-[60px] h-[60px] rounded-full cursor-pointer">
            <MdNotifications size={28} className="text-indigo-500 mb-2" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>
          <div className="flex pt-2 items-center justify-center gap-2 w-[60px] h-[60px] rounded-full cursor-pointer">
            <BiTransfer size={32} className="text-indigo-500 mb-2" />
          </div>
          <div ref={profileRef} className="relative">
            <div
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-center gap-2 w-[60px] h-[60px] rounded-full cursor-pointer hover:bg-gray-100 transition"
            >
              <img
                src="/assets/images/th-1/RLR .jpg"
                className="w-[60px] h-[60px] rounded-full"
                alt=""
              />
            </div>

            {/* Menu déroulant du profil */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-[450px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
                {/* En-tête du profil */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <img
                      src="/assets/images/th-1/RLR .jpg"
                      className="w-16 h-16 rounded-full border-4 border-white"
                      alt=""
                    />
                    <div>
                      <h3 className="text-white font-bold text-lg">Utilisateur</h3>
                      <p className="text-indigo-100 text-sm">lalapet11@email.com</p>
                    </div>
                  </div>
                </div>

                {/* Séparateur */}
                <div className="h-px bg-gray-200"></div>

                {/* Menu items */}
                <div className="p-3">
                  {/* Mon Profil */}
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700">
                    <FaUser size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Mon Profil</p>
                      <p className="text-xs text-gray-500">Voir et éditer votre profil</p>
                    </div>
                  </button>

                  {/* Paramètres */}
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700">
                    <FaCog size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Paramètres</p>
                      <p className="text-xs text-gray-500">Gérer vos préférences</p>
                    </div>
                  </button>

                  {/* Activité */}
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700">
                    <FaClock size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Activité</p>
                      <p className="text-xs text-gray-500">Historique de connexion</p>
                    </div>
                  </button>

                  {/* Apparence */}
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700">
                    <FaPalette size={18} className="text-indigo-500" />
                    <div className="text-left">
                      <p className="font-semibold text-sm">Apparence</p>
                      <p className="text-xs text-gray-500">Personnaliser l'interface</p>
                    </div>
                  </button>

                  {/* Mode Sombre */}
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition text-gray-700"
                  >
                    <MdDarkMode size={18} className="text-indigo-500" />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-sm">Mode Sombre</p>
                      <p className="text-xs text-gray-500">{isDarkMode ? 'Activé' : 'Désactivé'}</p>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        isDarkMode ? 'bg-indigo-500' : 'bg-gray-300'
                      } flex items-center p-1`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          isDarkMode ? 'translate-x-4' : ''
                        }`}
                      ></div>
                    </div>
                  </button>
                </div>

                {/* Séparateur */}
                <div className="h-px bg-gray-200"></div>

                {/* Déconnexion */}
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-b-lg hover:bg-red-50 transition text-red-600 font-semibold">
                  <FaSignOutAlt size={18} />
                  <span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row items-start justify-start gap-3 w-full mx-auto">
        {/* Liste des pairs en ligne - Gauche (sidebar fixe) */}
        <div className="lg:col-span-1 w-full lg:w-1/5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Utilisateurs en ligne</h2>
            <div className="flex-1 overflow-y-auto">
              <PeerList />
            </div>
            {selectedPeer && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">Destinataire sélectionné</p>
                <p className="text-xs text-blue-600 truncate">{selectedPeer}</p>
              </div>
            )}
          </div>
        </div>

        {children}

        {/* Panneau de droite - Informations (sidebar fixe) */}
        <div className="lg:col-span-1 w-full lg:w-1/5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Informations</h2>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-1">Transfert P2P</h3>
                <p className="text-sm text-blue-700">
                  Les fichiers sont transférés directement entre utilisateurs sans passer par un
                  serveur.
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <h3 className="font-medium text-green-800 mb-1">Sécurité</h3>
                <p className="text-sm text-green-700">
                  Connexion chiffrée de bout en bout. Vos fichiers restent privés.
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <h3 className="font-medium text-purple-800 mb-1">Vitesse</h3>
                <p className="text-sm text-purple-700">
                  Transfert direct = Pas de limitation de vitesse serveur.
                </p>
              </div>
            </div>

            {selectedPeer && (
              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800">Prêt pour le transfert</p>
                <p className="text-xs text-green-700">Connecté à: {selectedPeer}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
