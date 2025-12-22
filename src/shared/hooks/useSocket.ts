// hooks/useSocket.ts

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { getSocketClient, SocketEvent } from '@/lib/socket/SocketClient';
import { useAuthStore } from '@/stores/authStore';

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketClient = useRef(getSocketClient());
  
  // 🆕 Stocker la référence pour éviter les re-connexions
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Se connecter si authentifié et pas encore connecté
    if (isAuthenticated && accessToken && !socketClient.current.isConnected()) {
      console.log('🔌 Connecting socket...');
      socketClient.current.connect(accessToken);
      lastTokenRef.current = accessToken;
    }

    // Se déconnecter si plus authentifié
    if (!isAuthenticated && socketClient.current.isConnected()) {
      console.log('🔌 Disconnecting socket...');
      socketClient.current.disconnect();
      lastTokenRef.current = null;
    }

    // 🆕 Reconnecter si le token change (changement d'utilisateur)
    if (
      isAuthenticated && 
      accessToken && 
      lastTokenRef.current !== accessToken && 
      socketClient.current.isConnected()
    ) {
      console.log('🔄 Token changed, reconnecting...');
      socketClient.current.disconnect();
      socketClient.current.connect(accessToken);
      lastTokenRef.current = accessToken;
    }
  }, [isAuthenticated, accessToken]);

  // 🆕 Mémoïser les fonctions pour qu'elles gardent la même référence
  const api = useMemo(() => ({
    emit: (event: string, data?: any) => {
      socketClient.current.emit(event, data);
    },
    
    on: (event: SocketEvent, handler: Function) => {
      socketClient.current.on(event, handler);
    },
    
    off: (event: SocketEvent, handler?: Function) => {
      socketClient.current.off(event, handler);
    },
    
    isConnected: () => {
      return socketClient.current.isConnected();
    },
    
    socket: socketClient.current,
  }), []); // ⚠️ Dépendances vides = mêmes références toujours

  return api;
}