'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Hook pour afficher les notifications P2P (connexion/déconnexion)
 */
export function useP2PNotifications() {
  const { toast } = useToast();

  useEffect(() => {
    // ✅ Écouter quand un pair se connecte
    const handleP2PConnected = (event: CustomEvent) => {
      const { peerId } = event.detail;
      console.log('🟢 P2P Connected notification:', peerId);
      // Optionnel: afficher une notification discrète
      // toast({
      //   title: 'Connexion établie',
      //   description: 'Prêt pour transférer des fichiers',
      //   variant: 'default',
      // });
    };

    // ✅ Écouter quand un pair se déconnecte
    const handleP2PDisconnected = (event: CustomEvent) => {
      const { peerId, peerName, state } = event.detail;
      console.log(`🔴 P2P Disconnected notification: ${peerName} (${state})`);

      // Afficher un message clair
      const stateMessage =
        state === 'failed'
          ? 'La connexion a été perdue'
          : 'La connexion a été fermée';

      toast({
        title: 'Connexion fermée',
        description: `${peerName || 'Peer'}: ${stateMessage}`,
        variant: 'default',
      });
    };

    window.addEventListener('p2p:connected', handleP2PConnected as EventListener);
    window.addEventListener('p2p:disconnected', handleP2PDisconnected as EventListener);

    return () => {
      window.removeEventListener('p2p:connected', handleP2PConnected as EventListener);
      window.removeEventListener('p2p:disconnected', handleP2PDisconnected as EventListener);
    };
  }, [toast]);
}
