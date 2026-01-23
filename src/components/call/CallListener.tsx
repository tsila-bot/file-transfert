'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocketClient } from '@/lib/socket/SocketClient';
import { useCall } from '@/shared/hooks/useCall';
import { IncomingCall } from './IncomingCall';

interface IncomingCallRequest {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

/**
 * CallListener - Écoute les appels entrants GLOBALEMENT
 * Montée dans le layout principal pour recevoir les appels
 * peu importe la page actuelle
 * 
 * ⚠️ Utilise getSocketClient() directement pour éviter que le cleanup
 * du hook useSocket() ne supprime les handlers quand on navigue
 */
export function CallListener() {
  const router = useRouter();
  const socketClient = getSocketClient();
  const { acceptCall, rejectCall } = useCall();
  const [incomingCall, setIncomingCall] = useState<IncomingCallRequest | null>(null);
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);

  useEffect(() => {
    console.log('📞 CallListener: Enregistrement du handler global call_offer');

    // Utiliser getSocketClient() directement pour éviter cleanup du hook
    const handleCallOffer = (data: IncomingCallRequest) => {
      console.log('📞 CallListener: Appel entrant reçu de:', data.callerName, data);
      setIncomingCall(data);
    };

    const cleanup = socketClient.on('call_offer', handleCallOffer);

    return () => {
      console.log('🧹 CallListener: Suppression du handler call_offer');
      cleanup();
    };
  }, [socketClient]);

  const handleAccept = async () => {
    if (!incomingCall) return;

    setIsAcceptingCall(true);
    try {
      console.log('✅ Accepting call from:', incomingCall.callerName);
      await acceptCall(incomingCall.callerId, incomingCall.callerName);
      setIncomingCall(null);
      
      // 🔴 Rediriger vers la page d'appel
      console.log('📍 Navigating to calls page...');
      router.push('/calls');
    } catch (error) {
      console.error('❌ Erreur lors de l\'acceptation de l\'appel:', error);
    } finally {
      setIsAcceptingCall(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;

    console.log('❌ Rejecting call from:', incomingCall.callerName);
    rejectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  // Ne rien afficher si pas d'appel entrant
  if (!incomingCall) {
    return null;
  }

  // Afficher le modal d'appel entrant
  return (
    <IncomingCall
      callerName={incomingCall.callerName}
      callerAvatar={incomingCall.callerAvatar}
      onAccept={handleAccept}
      onReject={handleReject}
      isLoading={isAcceptingCall}
    />
  );
}
