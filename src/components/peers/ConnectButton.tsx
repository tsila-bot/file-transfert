// components/peers/ConnectButton.tsx

'use client';

import { useState } from 'react';
import { useP2P } from '../../shared/hooks/useP2P';
import { Peer } from '@/stores/peerStore';
import { usePeerStore } from '@/stores/peerStore';

interface ConnectButtonProps {
  peer: Peer;
}

export function ConnectButton({ peer }: ConnectButtonProps) {
  const { connect, disconnect, getConnection } = useP2P();
  const [isConnecting, setIsConnecting] = useState(false);

  // ✅ CHANGÉ: Utiliser les nouvelles fonctions
  const { toggleActivePeer, isActivePeer } = usePeerStore();

  const connection = getConnection(peer.userId);
  const isConnected = connection?.isConnected();
  const isSelected = isActivePeer(peer.userId);

  const handleConnect = async () => {
    if (isConnected) {
      // Déconnecter
      disconnect(peer.userId);
      // ✅ CHANGÉ: Retirer de la sélection
      usePeerStore.getState().removeActivePeer(peer.userId);
    } else {
      // Connecter
      setIsConnecting(true);
      try {
        await connect(peer.userId, peer.userName);
        // ✅ CHANGÉ: Ajouter à la sélection (sans remplacer les autres)
        usePeerStore.getState().addActivePeer(peer.userId);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  // ✅ NOUVEAU: Toggle la sélection
  const handleToggleSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) {
      toggleActivePeer(peer.userId);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Bouton de connexion/déconnexion */}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className={`px-3 py-1 text-sm rounded-md transition-colors ${isConnected
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isConnecting
          ? 'Connexion...'
          : isConnected
            ? 'Déconnecter'
            : 'Connecter'}
      </button>

      {/* ✅ NOUVEAU: Checkbox de sélection */}
      {isConnected && (
        <button
          onClick={handleToggleSelection}
          className={`px-2 py-1 text-sm rounded-md transition-colors border-2 ${isSelected
              ? 'bg-green-500 border-green-600 text-white'
              : 'bg-white border-gray-300 text-gray-600'
            }`}
          title={isSelected ? 'Désélectionner' : 'Sélectionner pour transfert'}
        >
          {isSelected ? '✓' : '○'}
        </button>
      )}
    </div>
  );
}
