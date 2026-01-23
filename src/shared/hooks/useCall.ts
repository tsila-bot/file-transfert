'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useP2P } from './useP2P';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { getP2PManager } from '@/core/P2P/P2PManager';

export interface CallState {
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'error';
  recipientId?: string;
  recipientName?: string;
  duration: number;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  micOn: boolean;
  videoOn: boolean;
  error?: string;
}

export function useCall() {
  const socket = useSocket();
  const { connect, disconnect } = useP2P();
  const { user } = useAuthStore();
  const { callState, updateCallState, resetCallState } = useCallStore();

  const durationInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const localStreamRef = useRef<MediaStream | undefined>(undefined);

  // Vérifier si getUserMedia est disponible
  const isMediaAvailable = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return !!(
      navigator?.mediaDevices?.getUserMedia ||
      (navigator as any)?.webkitGetUserMedia ||
      (navigator as any)?.mozGetUserMedia
    );
  }, []);

  // Démarrer un appel
  const startCall = useCallback(
    async (recipientId: string, recipientName: string) => {
      try {
        if (!isMediaAvailable()) {
          throw new Error('getUserMedia non disponible sur cet appareil');
        }

        updateCallState({
          status: 'calling',
          recipientId,
          recipientName,
        });

        // Essayer d'obtenir le flux vidéo+audio
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          console.log('✅ Flux vidéo+audio obtenu');
        } catch (videoError) {
          // Si vidéo échoue, essayer audio seul
          console.warn('⚠️ Vidéo non disponible, essai audio uniquement:', videoError);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true },
            video: false,
          });
          console.log('✅ Flux audio obtenu (vidéo non disponible)');
        }

        localStreamRef.current = stream;
        updateCallState({ localStream: stream });

        // Établir la connexion P2P
        const connection = await connect(recipientId, recipientName);
        
        if (connection) {
          // ✨ NOUVEAU: Ajouter le stream local à la connexion P2P pour envoyer audio/vidéo
          console.log('📤 Adding local stream to P2P connection');
          await connection.addStream(stream);
          
          // Écouter le remote stream quand il arrive
          connection.once('remotestream', (remoteStream: MediaStream) => {
            console.log('📹 Remote stream received in startCall');
            updateCallState({ remoteStream });
          });
        }

        // Signaler l'appel au serveur (événement correct)
        socket?.emit('call_offer', {
          recipientId,
          callerId: user?.id,
          callerName: user?.name,
        });
      } catch (error) {
        console.error('Erreur lors du démarrage de l\'appel:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        updateCallState({
          status: 'error',
          error: errorMessage,
        });
      }
    },
    [connect, socket, user, isMediaAvailable, updateCallState]
  );

  // Accepter un appel entrant
  const acceptCall = useCallback(
    async (callerId: string, callerName: string) => {
      try {
        if (!isMediaAvailable()) {
          throw new Error('getUserMedia non disponible sur cet appareil');
        }

        updateCallState({
          status: 'calling',
          recipientId: callerId,
          recipientName: callerName,
        });

        // Essayer d'obtenir le flux vidéo+audio
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true },
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          console.log('✅ Flux vidéo+audio obtenu');
        } catch (videoError) {
          // Si vidéo échoue, essayer audio seul
          console.warn('⚠️ Vidéo non disponible, essai audio uniquement:', videoError);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true },
            video: false,
          });
          console.log('✅ Flux audio obtenu (vidéo non disponible)');
        }

        localStreamRef.current = stream;
        updateCallState({ localStream: stream });

        // Établir la connexion P2P
        const connection = await connect(callerId, callerName);
        
        if (connection) {
          // ✨ NOUVEAU: Ajouter le stream local à la connexion P2P pour envoyer audio/vidéo
          console.log('📤 Adding local stream to P2P connection');
          await connection.addStream(stream);
          
          // Écouter le remote stream quand il arrive
          connection.once('remotestream', (remoteStream: MediaStream) => {
            console.log('📹 Remote stream received in acceptCall');
            updateCallState({ remoteStream });
          });
        }

        // Confirmer au serveur (événement correct)
        socket?.emit('call_answer', {
          callerId,
          recipientId: user?.id,
        });

        // Passer au statut connecté immédiatement pour le récepteur
        console.log('🔄 Changement status: calling → connected');
        updateCallState({ status: 'connected' });
        // Timer will be started by useEffect watching callState.status
      } catch (error) {
        console.error('Erreur lors de l\'acceptation de l\'appel:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        updateCallState({
          status: 'error',
          error: errorMessage,
        });
      }
    },
    [connect, socket, user, isMediaAvailable, updateCallState]
  );

  // Rejeter un appel
  const rejectCall = useCallback(
    (callerId: string) => {
      socket?.emit('call_end', { targetUserId: callerId });
      resetCallState();
    },
    [socket, resetCallState]
  );

  // Terminer l'appel
  const stopCall = useCallback(async () => {
    console.log('🛑 Stopping call...');

    // ✨ Nettoyer complètement les ressources média de la connexion P2P
    // (retire les pistes, arrête les timers, désactive les handlers)
    // La connexion P2P reste active pour les transferts de fichiers
    const recipientId = callState.recipientId;
    if (recipientId && user) {
      try {
        const p2pManager = getP2PManager(user.id);
        const connection = p2pManager.getConnection(recipientId);
        if (connection) {
          console.log('🧹 Cleaning up media resources from P2P connection');
          await connection.cleanupMedia();
        }
      } catch (error) {
        console.error('Error cleaning up P2P media:', error);
      }
    }

    // Arrêter les flux LOCAUX (MIC/CAMÉRA)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log('🛑 Stopping local track:', track.kind);
        track.stop();
      });
      localStreamRef.current = undefined;
    }

    // Arrêter les flux DISTANTS (voix/vidéo reçus)
    if (callState.remoteStream) {
      callState.remoteStream.getTracks().forEach((track) => {
        console.log('🛑 Stopping remote track:', track.kind);
        track.stop();
      });
    }

    // Arrêter le minuteur
    if (durationInterval.current) {
      console.log('🛑 Stopping timer');
      clearInterval(durationInterval.current);
      durationInterval.current = undefined;
    }

    // Notifier l'autre utilisateur de la fin de l'appel (mais garder P2P active pour transfers)
    if (recipientId && socket) {
      console.log('🛑 Notifying peer of call end');
      socket.emit('call_end', { targetUserId: recipientId });
    }

    // ⚠️ NE PAS APPELER disconnect() - on garde la connexion P2P pour les transferts de fichiers!
    // ⚠️ DO NOT call disconnect() - keep P2P connection alive for file transfers!

    // Réinitialiser le state de l'appel seulement
    console.log('🛑 Resetting call state (keeping P2P connection alive)');
    updateCallState({
      status: 'idle',
      recipientId: undefined,
      recipientName: undefined,
      localStream: undefined,
      remoteStream: undefined,
      duration: 0,
      error: undefined,
    });
  }, [callState.recipientId, callState.remoteStream, socket, user, updateCallState]);

  // Basculer le microphone
  const toggleMic = useCallback(() => {
    console.log('🎤 Toggle Mic - current state:', callState.micOn);
    
    // Utiliser uniquement localStreamRef
    const stream = localStreamRef.current;
    console.log('🎤 Stream available:', !!stream);
    
    const newMicState = !callState.micOn;
    
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      console.log('🎤 Audio tracks found:', audioTracks.length);
      
      audioTracks.forEach((track, index) => {
        track.enabled = newMicState;
        console.log(`🎤 Track ${index} enabled:`, track.enabled);
      });
    } else {
      console.warn('⚠️ No stream available to toggle mic');
    }
    
    // 🆕 Mettre à jour l'état des pistes dans toutes les connexions P2P actives
    if (user && callState.recipientId) {
      try {
        const p2pManager = getP2PManager(user.id);
        const connection = p2pManager.getConnection(callState.recipientId);
        
        if (connection) {
          console.log(`🎤 Updating audio track state in P2P connection for ${callState.recipientId}`);
          connection.updateAudioTrackState(newMicState);
        } else {
          console.warn(`⚠️ No P2P connection found for ${callState.recipientId}`);
        }
      } catch (error) {
        console.error('Error updating P2P audio track state:', error);
      }
    }
    
    updateCallState({ micOn: newMicState });
    console.log('🎤 Toggle Mic - new state:', newMicState);
  }, [callState.micOn, callState.recipientId, user, updateCallState]);

  // Basculer la vidéo
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    updateCallState({ videoOn: !callState.videoOn });
  }, [callState.videoOn, updateCallState]);

  // Gérer le minuteur de durée
  useEffect(() => {
    if (callState.status === 'connected') {
      console.log('⏱️ Starting call timer...');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      durationInterval.current = setInterval(() => {
        // Use updateCallState to trigger component updates
        const currentState = useCallStore.getState().callState;
        const newDuration = currentState.duration + 1;
        console.log(`⏱️ Duration: ${newDuration}s`);
        updateCallState({ duration: newDuration });
      }, 1000);

      return () => {
        if (durationInterval.current) {
          console.log('⏱️ Stopping call timer');
          clearInterval(durationInterval.current);
          durationInterval.current = undefined;
        }
      };
    }
  }, [callState.status, updateCallState]);

  // Écouter les événements de l'appel (sauf call_offer qui est écouté globalement)
  useEffect(() => {
    if (!socket) return;

    // Appel accepté
    const handleCallAnswer = () => {
      console.log('📞 Call answered');
      updateCallState({ status: 'connected' });
      // Timer will be started by useEffect watching callState.status
    };

    // Appel terminé
    const handleCallEnd = () => {
      console.log('📞 Call ended');
      stopCall();
    };

    socket.on('call_answer', handleCallAnswer);
    socket.on('call_end', handleCallEnd);

    return () => {
      socket.off('call_answer', handleCallAnswer);
      socket.off('call_end', handleCallEnd);
    };
    // Changed to avoid re-registering handlers when stopCall changes
  }, [socket, stopCall, updateCallState]);

  return {
    callState,
    startCall,
    acceptCall,
    rejectCall,
    stopCall,
    toggleMic,
    toggleVideo,
  };
}
