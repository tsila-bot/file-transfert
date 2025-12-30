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
  const connection = getConnection(peer.userId);
  const isConnected = connection?.isConnected();

  const handleConnect = async () => {
    if (isConnected) {
      disconnect(peer.userId);
      // Clear active selection if it was this peer
      if (usePeerStore.getState().activePeerId === peer.userId) {
        usePeerStore.getState().setActivePeer(null);
      }
    } else {
      setIsConnecting(true);
      try {
        await connect(peer.userId, peer.userName);
        // Set this peer as active selection
        usePeerStore.getState().setActivePeer(peer.userId);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  return (
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
  );
}