'use client';

import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CallControls } from '@/components/call/CallControls';
import { CallInfo } from '@/components/call/CallInfo';
import { CallLayout } from '@/components/call/CallLayout';
import { IncomingCall } from '@/components/call/IncomingCall';
import { VideoElement } from '@/components/call/VideoElement';
import { useCall } from '@/shared/hooks/useCall';
import { useCallStore } from '@/stores/callStore';

interface IncomingCallRequest {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
}

export default function CallsPage() {
  const { callState } = useCallStore();
  const {
    startCall,
    acceptCall,
    rejectCall,
    stopCall,
    toggleMic,
    toggleVideo,
  } = useCall();

  const [incomingCall, setIncomingCall] = useState<IncomingCallRequest | null>(
    null
  );
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);

  // Debug: log du callState
  useEffect(() => {
    console.log('📞 CallsPage - callState:', {
      status: callState.status,
      duration: callState.duration,
      recipientName: callState.recipientName,
      hasLocalStream: !!callState.localStream,
      hasRemoteStream: !!callState.remoteStream,
      micOn: callState.micOn,
    });
  }, [callState]);

  // Synchroniser l'appel entrant avec le state du hook
  useEffect(() => {
    if (callState.status === 'ringing' && callState.recipientId) {
      setIncomingCall({
        callerId: callState.recipientId,
        callerName: callState.recipientName || 'Inconnu',
      });
    } else if (callState.status !== 'ringing') {
      setIncomingCall(null);
    }
  }, [callState.status, callState.recipientId, callState.recipientName]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    setIsAcceptingCall(true);
    try {
      await acceptCall(incomingCall.callerId, incomingCall.callerName);
      setIncomingCall(null);
    } finally {
      setIsAcceptingCall(false);
    }
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    rejectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  // Protection: avertir si on essaie de quitter avec un appel actif
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (callState.status === 'connected' || callState.status === 'calling') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [callState.status]);

  // Interface en appel
  if (callState.status === 'connected' || callState.status === 'calling') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appel en cours</h1>
          <p className="text-gray-500 mt-1">
            {callState.recipientName || 'Appel en cours...'}
          </p>
        </div>

        <CallLayout
          localVideo={
            <VideoElement
              stream={callState.localStream}
              label="Vous"
              isLocal
            />
          }
          remoteVideo={
            <VideoElement
              stream={callState.remoteStream}
              label={callState.recipientName || 'Utilisateur distant'}
            />
          }
          info={
            <CallInfo
              recipientName={callState.recipientName || 'Utilisateur distant'}
              recipientStatus={
                callState.status === 'connected' ? 'connected' : 'connecting'
              }
              duration={callState.duration}
              connectionQuality="good"
            />
          }
          controls={
            <CallControls
              micOn={callState.micOn}
              videoOn={callState.videoOn}
              onToggleMic={toggleMic}
              onToggleVideo={toggleVideo}
              onEndCall={stopCall}
              isLoading={false}
            />
          }
        />
      </div>
    );
  }

  // Interface en attente d'appel
  if (callState.status === 'ringing' && !callState.localStream) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appel en cours</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="animate-pulse">
                <div className="w-24 h-24 bg-indigo-200 rounded-full mx-auto flex items-center justify-center">
                  <Phone className="text-indigo-600 animate-bounce" size={48} />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Appel en cours...
              </h2>
              <p className="text-gray-500 mt-2">
                Établissement de la connexion avec {callState.recipientName}
              </p>
            </div>

            <button
              onClick={stopCall}
              className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Interface erreur
  if (callState.status === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appels Vidéo</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg shadow p-8">
          <div className="text-center space-y-4">
            <p className="text-red-800 font-semibold">
              Erreur lors de l'appel
            </p>
            <p className="text-red-600">{callState.error}</p>
            <button
              onClick={stopCall}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Interface idle (aucun appel)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Appels Vidéo</h1>
        <p className="text-gray-500 mt-1">
          Gérez vos appels vidéo et audio en P2P
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <Phone className="text-indigo-600" size={48} />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Aucun appel en cours
        </h2>
        <p className="text-gray-500 mb-6">
          Allez à la section Contacts pour commencer un appel vidéo
        </p>
        <a
          href="/contacts"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
        >
          Aller aux Contacts
        </a>
      </div>

      {/* Appel entrant */}
      {incomingCall && (
        <IncomingCall
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          isLoading={isAcceptingCall}
        />
      )}
    </div>
  );
}
