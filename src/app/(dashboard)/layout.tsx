
'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, File, X, Check, AlertCircle, Cloud, Loader } from 'lucide-react';
import { PeerManager } from '@/components/peers/PeerManager';
import { PeerList } from '@/components/peers/PeerList';



export default function DashboardPage({ children }: { children: React.ReactNode }) {

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  return (
    <div className="p-6 pt-24"> {/* Augmenté le padding-top pour le header fixe */}
      {/* Gestionnaire de peers (invisible) */}
      <PeerManager />

      {/* Header fixe avec z-10 */}
      <div className="fixed top-0 left-0 right-0 bg-cyan-950 z-10 border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Dashboard P2P</h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-start gap-3 w-full mx-auto">
        {/* Liste des pairs en ligne - Gauche (sidebar fixe) */}
        <div className="lg:col-span-1 w-full lg:w-1/5 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Utilisateurs en ligne</h2>
            <div className="flex-1 overflow-y-auto">
              <PeerList
              />
            </div>
            {selectedPeer && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">
                  Destinataire sélectionné
                </p>
                <p className="text-xs text-blue-600 truncate">
                  {selectedPeer}
                </p>
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
                  Les fichiers sont transférés directement entre utilisateurs sans passer par un serveur.
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
                <p className="text-sm font-medium text-green-800">
                  Prêt pour le transfert
                </p>
                <p className="text-xs text-green-700">
                  Connecté à: {selectedPeer}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}