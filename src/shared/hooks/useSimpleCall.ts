'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface SimpleCallState {
  status: 'idle' | 'calling' | 'connected' | 'error';
  recipientId?: string;
  recipientName?: string;
  duration: number;
  micOn: boolean;
  videoOn: boolean;
  error?: string;
}

export function useSimpleCall() {
  const { user } = useAuthStore();

  const [callState, setCallState] = useState<SimpleCallState>({
    status: 'idle',
    duration: 0,
    micOn: true,
    videoOn: true,
  });

  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Démarrer un appel simple
  const startCall = useCallback(
    async (recipientId: string, recipientName: string) => {
      try {
        setCallState((prev) => ({
          ...prev,
          status: 'calling',
          recipientId,
          recipientName,
        }));

        console.log('🎯 Initiation appel avec:', recipientName);

        // Vérifier si getUserMedia est disponible
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Caméra/Microphone non disponible');
        }

        // Obtenir le flux local
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        localStreamRef.current = stream;

        setCallState((prev) => ({
          ...prev,
          status: 'connected',
          duration: 0,
        }));

        console.log('✅ Appel connecté');
      } catch (error) {
        console.error('❌ Erreur appel:', error);
        setCallState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        }));
      }
    },
    []
  );

  // Terminer l'appel
  const stopCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }

    setCallState({
      status: 'idle',
      duration: 0,
      micOn: true,
      videoOn: true,
    });
  }, []);

  // Basculer le microphone
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setCallState((prev) => ({ ...prev, micOn: !prev.micOn }));
  }, []);

  // Basculer la vidéo
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setCallState((prev) => ({ ...prev, videoOn: !prev.videoOn }));
  }, []);

  // Minuteur
  useEffect(() => {
    if (callState.status !== 'connected') return;

    if (durationInterval.current) clearInterval(durationInterval.current);

    durationInterval.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);

    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, [callState.status]);

  return {
    callState,
    startCall,
    stopCall,
    toggleMic,
    toggleVideo,
    localStream: localStreamRef.current,
  };
}
