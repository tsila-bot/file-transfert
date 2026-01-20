// hooks/useP2P.ts

import { useEffect, useState, useCallback } from 'react';
import { getP2PManager, destroyP2PManager } from '../../core/P2P/P2PManager';
import { PeerConnection } from '../../core/P2P/PeerConnection';
import { useAuthStore } from '@/stores/authStore';

export function useP2P() {
  const { user } = useAuthStore();
  const [p2pManager, setP2PManager] = useState<ReturnType<typeof getP2PManager> | null>(null);
  const [activeConnections, setActiveConnections] = useState<PeerConnection[]>([]);

  useEffect(() => {
    if (user) {
      const manager = getP2PManager(user.id);
      setP2PManager(manager);

      // Écouter les événements globaux
      const handleConnected = (event: CustomEvent<{ peerId: string }>) => {
        console.log('P2P Connected:', event.detail.peerId);
        setActiveConnections(manager.getActiveConnections());
      };

      const handleError = (event: CustomEvent<{ error: Error }>) => {
        console.error('P2P Error:', event.detail.error);
      };

      window.addEventListener('p2p:connected', handleConnected as EventListener);
      window.addEventListener('p2p:error', handleError as EventListener);

      return () => {
        // ❌ NE PAS détruire le P2PManager lors du changement de page
        // Les connexions P2P doivent rester actives pour fonctionner correctement
        window.removeEventListener('p2p:connected', handleConnected as EventListener);
        window.removeEventListener('p2p:error', handleError as EventListener);
        // destroyP2PManager(); // REMOVED - keeps connections alive during navigation
      };
    }
  }, [user]);

  const connect = useCallback(
    async (peerId: string, peerName: string): Promise<PeerConnection | null> => {
      if (!p2pManager) return null;

      try {
        const connection = await p2pManager.connect(peerId, peerName);
        setActiveConnections(p2pManager.getActiveConnections());
        return connection;
      } catch (error) {
        console.error('Failed to connect:', error);
        return null;
      }
    },
    [p2pManager]
  );

  const disconnect = useCallback(
    (peerId: string) => {
      if (p2pManager) {
        p2pManager.disconnect(peerId);
        setActiveConnections(p2pManager.getActiveConnections());
      }
    },
    [p2pManager]
  );

  const getConnection = useCallback(
    (peerId: string): PeerConnection | undefined => {
      return p2pManager?.getConnection(peerId);
    },
    [p2pManager]
  );

  return {
    p2pManager,
    activeConnections,
    connect,
    disconnect,
    getConnection,
  };
}