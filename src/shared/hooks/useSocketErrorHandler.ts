'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocketClient } from '@/lib/socket/SocketClient';
import { isStructuredError, getErrorMessage } from '@/lib/socket/error-codes';
import { useToast } from '@/components/ui/use-toast';

/**
 * Hook pour gérer et afficher les erreurs Socket.IO structurées
 */
export function useSocketErrorHandler() {
  const { toast } = useToast();
  const socketClient = getSocketClient();
  const hasInitialized = useRef(false); // ✅ Empêcher les doubles enregistrements

  // Handler pour les erreurs structurées
  const handleStructuredError = useCallback(
    (error: any) => {
      if (isStructuredError(error)) {
        const userMessage = getErrorMessage(error.code);
        console.error(`❌ [${error.code}] ${error.message}`);

        // Afficher le toast à l'utilisateur
        toast({
          title: 'Erreur',
          description: userMessage,
          variant: 'destructive',
        });

        // Log pour debug
        console.debug('Full error details:', error);
      }
    },
    [toast]
  );

  // Handler pour les erreurs de connexion
  const handleConnectionError = useCallback(
    (error: any) => {
      console.error('❌ Socket connection error:', error);
      toast({
        title: 'Erreur de connexion',
        description: 'Impossible de se connecter au serveur',
        variant: 'destructive',
      });
    },
    [toast]
  );

  // ✅ Handler pour quand un utilisateur se déconnecte
  const handleUserOffline = useCallback(
    (data: any) => {
      console.log('🔴 User offline data:', data);
      
      // Extraire le nom de l'utilisateur (peut être dans différents champs)
      const userName = data?.userName || data?.name || data?.user?.name || 'Utilisateur';
      
      console.log(`🔴 ${userName} s'est déconnecté`);
      toast({
        title: 'Utilisateur déconnecté',
        description: `${userName} a quitté la session`,
        variant: 'default', // Info message (not destructive)
      });
    },
    [toast]
  );

  // ✅ Handler pour la déconnexion Socket.IO
  const handleSocketDisconnect = useCallback(
    (reason: any) => {
      console.log('🔌 Socket disconnected:', reason);
      if (reason !== 'io client namespace disconnect') {
        toast({
          title: 'Déconnecté du serveur',
          description: 'Vous avez été déconnecté. Reconnexion en cours...',
          variant: 'default',
        });
      }
    },
    [toast]
  );

  // Setup listeners
  useEffect(() => {
    // ✅ Empêcher les doubles enregistrements
    if (hasInitialized.current) {
      console.log('⚠️ useSocketErrorHandler already initialized, skipping');
      return;
    }
    hasInitialized.current = true;

    console.log('🚀 Initializing useSocketErrorHandler...');

    // Écouter les erreurs structurées du backend
    const unsubstructured = socketClient.on('socket:error:structured', handleStructuredError);

    // Écouter les erreurs de connexion
    const unsubconnect = socketClient.on('connect_error', handleConnectionError);

    // ✅ Écouter quand un utilisateur se déconnecte
    const unsubUserOffline = socketClient.on('user_offline', handleUserOffline);

    // ✅ Écouter la déconnexion Socket.IO
    const unsubDisconnect = socketClient.on('disconnect', handleSocketDisconnect);

    return () => {
      try {
        unsubstructured();
        unsubconnect();
        unsubUserOffline();
        unsubDisconnect();
      } catch (err) {
        console.warn('Error unsubscribing from socket error handlers:', err);
      }
    };
  }, [socketClient, handleStructuredError, handleConnectionError, handleUserOffline, handleSocketDisconnect]);

  return { handleStructuredError, handleConnectionError, handleUserOffline, handleSocketDisconnect };
}
