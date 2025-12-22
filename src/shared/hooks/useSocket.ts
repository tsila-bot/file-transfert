// hooks/useSocket.ts

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { getSocketClient, SocketEvent } from '@/lib/socket/SocketClient';
import { useAuthStore } from '@/stores/authStore';

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketClient = useRef(getSocketClient());
  const cleanupRef = useRef<(() => void)[]>([]); // 🆕 Stocker les fonctions de cleanup

  const connect = useCallback(() => {
    if (isAuthenticated && accessToken && !socketClient.current.isConnected()) {
      console.log('🔌 Connecting socket...');
      socketClient.current.connect(accessToken);
    }
  }, [isAuthenticated, accessToken]);

  const disconnect = useCallback(() => {
    if (socketClient.current.isConnected()) {
      console.log('🔌 Disconnecting socket...');
      socketClient.current.disconnect();
    }
  }, []);

  // 🆕 Fonction wrapper pour on avec cleanup automatique
  const on = useCallback((event: SocketEvent, handler: Function) => {
    const cleanup = socketClient.current.on(event, handler);
    cleanupRef.current.push(cleanup);
    return cleanup;
  }, []);

  // 🆕 Fonction wrapper pour off
  const off = useCallback((event: SocketEvent, handler?: Function) => {
    socketClient.current.off(event, handler);

    // Retirer de la liste de cleanup
    if (handler) {
      cleanupRef.current = cleanupRef.current.filter(fn => {
        // Comparer les références de fonction
        try {
          fn(); // Tester si c'est la bonne fonction
          return true;
        } catch {
          return false;
        }
      });
    }
  }, []);

  useEffect(() => {
    connect();

    // Nettoyage à la fin
    return () => {
      console.log('🧹 Cleaning up socket listeners');

      // Exécuter toutes les fonctions de cleanup
      cleanupRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error('Error in cleanup function:', error);
        }
      });
      cleanupRef.current = [];

      // Se déconnecter si besoin
      if (socketClient.current.isConnected()) {
        disconnect();
      }
    };
  }, [connect, disconnect]);

  // 🆕 API mémoïsée
  const api = useMemo(() => ({
    emit: (event: string, data?: any) => {
      socketClient.current.emit(event, data);
    },

    on,

    off,

    isConnected: () => {
      return socketClient.current.isConnected();
    },

    socket: socketClient.current,

    // 🆕 Méthodes utilitaires
    connect,
    disconnect,

    // 🆕 Gestion des événements avec cleanup automatique dans useEffect
    useEventHandler: (event: SocketEvent, handler: Function) => {
      useEffect(() => {
        const cleanup = on(event, handler);
        return cleanup;
      }, [event, handler, on]);
    }
  }), [on, off, connect, disconnect]);

  return api;
}