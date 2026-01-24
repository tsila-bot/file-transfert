'use client';

import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '@/core/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocket } from '@/shared/hooks/useSocket';
import { GroupCallManager } from '@/core/services/webrtc/GroupCallManager';
import { GroupCallUI } from './GroupCallUI';
import type { GroupMessage } from '@/types/types';
import type { SocketEvent } from '@/lib/socket/SocketClient';
import type { GroupCallState, PeerConnection } from '@/core/services/webrtc/GroupCallManager';
import { Send, Phone, Video } from 'lucide-react';

interface GroupChatProps {
  teamId: string;
  teamName?: string;
}

interface ActiveCall {
  id: string;
  initiatorId: string;
  initiatorName?: string;
  type: 'audio' | 'video';
  participants: string[];
  startedAt: string;
}

export default function GroupChat({ teamId, teamName }: GroupChatProps) {
  const socket = useSocket();
  const authStore = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callManagerRef = useRef<GroupCallManager | null>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [callState, setCallState] = useState<GroupCallState | null>(null);
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(1);
  const [permissionError, setPermissionError] = useState<{ type: string; message: string } | null>(null);

  // Charger les messages initiales
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        const result = await chatAPI.getGroupMessages(teamId, 0, 50);
        if (result.success && result.data.messages) {
          setMessages(result.data.messages);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([]); // Fallback to empty messages
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [teamId]);

  // Initialiser le GroupCallManager
  useEffect(() => {
    if (!socket) return;
    callManagerRef.current = new GroupCallManager(socket);

    // Récupérer les serveurs ICE
    socket.on('ice_servers', (data: any) => {
      console.log('🧊 ICE servers reçus:', data.iceServers);
      setIceServers(data.iceServers);
    });

    socket.emit('get_ice_servers');

    return () => {
      // Nettoyer si nécessaire
    };
  }, [socket]);

  // Handlers pour les appels groupe
  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!socket || !callManagerRef.current) {
      console.error('Socket ou CallManager non disponible');
      return;
    }

    console.log(`📞 Démarrage appel ${type}`);

    try {
      const newCallState = await callManagerRef.current.initiateGroupCall(teamId, type, iceServers);
      setCallState(newCallState);
      setActiveCall({
        id: newCallState.callId,
        initiatorId: authStore.user?.id || '',
        type,
        participants: [authStore.user?.id || ''],
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erreur démarrage appel:', error);
    }
  };

  const handleAcceptCall = async () => {
    if (!socket || !incomingCall || !callManagerRef.current) return;

    console.log(`✅ Acceptation appel ${incomingCall.id}`);

    try {
      const newCallState = await callManagerRef.current.acceptGroupCall(
        teamId,
        incomingCall.id,
        incomingCall.type,
        iceServers
      );
      
      // ✅ Créer un peer pour l'initiateur avec son vrai nom
      await callManagerRef.current.createPeerConnection(
        incomingCall.initiatorId,
        incomingCall.initiatorName || 'Initiateur',
        false
      );
      
      setCallState(newCallState);
      setActiveCall(incomingCall);
      setIncomingCall(null);
      setPeers(callManagerRef.current.getPeers());
    } catch (error) {
      console.error('Erreur acceptation appel:', error);
    }
  };

  const handleRejectCall = () => {
    if (!incomingCall || !callManagerRef.current) return;

    console.log(`❌ Rejet appel ${incomingCall.id}`);
    callManagerRef.current.rejectGroupCall(teamId, incomingCall.id);
    setIncomingCall(null);
  };

  const handleEndCall = async () => {
    if (!callManagerRef.current) return;

    console.log('📞 Fin appel');
    await callManagerRef.current.endGroupCall();
    setCallState(null);
    setActiveCall(null);
    setPeers([]);
  };

  // Rejoindre le groupe et écouter les événements
  useEffect(() => {
    if (!socket) return;

    // Émettre join_group avec le bon paramètre
    socket.emit('join_group', { groupId: teamId });

    // Écouter les nouveaux messages
    const unsubscribeMessage = socket.on('group_chat_message', (data: any) => {
      console.log('📬 Nouveau message reçu:', data);
      const newMsg: GroupMessage = {
        id: data.id || `temp-${Date.now()}`,
        teamId,
        userId: data.userId,
        message: data.message,
        messageType: data.messageType || 'TEXT',
        user: data.user,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
    });

    // Écouter les appels entrants
    const unsubscribeInitiated = socket.on('group_call_initiated', (data: any) => {
      console.log('📞 Appel reçu:', data);
      console.log('🔍 Mon ID:', authStore.user?.id);
      console.log('🔍 Initiateur ID:', data.initiatorId);
      console.log('🔍 Est-ce que c\'est moi? ', data.initiatorId === authStore.user?.id);
      if (data.initiatorId !== authStore.user?.id) {
        console.log('✅ Définir incomingCall');
        setIncomingCall({
          id: data.callId,
          initiatorId: data.initiatorId,
          initiatorName: data.initiatorName,
          type: data.type,
          participants: data.participants || [],
          startedAt: new Date().toISOString(),
        });
      } else {
        console.log('⏭️ Skipping - Je suis l\'initiateur');
      }
    });

    // Écouter les appels actifs
    const unsubscribeActive = socket.on('group_call_active', (data: any) => {
      setActiveCall({
        id: data.callId,
        initiatorId: data.initiatorId,
        type: data.type,
        participants: data.participants || [],
        startedAt: data.startedAt || new Date().toISOString(),
      });
    });

    // Écouter la fin des appels
    const unsubscribeEnded = socket.on('group_call_ended', () => {
      setActiveCall(null);
      setIncomingCall(null);
      setCallState(null);
      setPeers([]);
      setTotalParticipants(1);
    });

    // 👥 Écouter les mises à jour du nombre total de participants
    const unsubscribeParticipantCount = socket.on('group_call_participant_count', (data: any) => {
      console.log(`👥 Nombre total de participants: ${data.count}`);
      setTotalParticipants(data.count);
    });

    // ⚠️ Écouter les demandes de permissions
    const unsubscribePermission = socket.on('request_permission', (data: any) => {
      console.warn(`⚠️ Permission requise: ${data.message}`);
      setPermissionError(data);
    });

    // WebRTC Events pour appels groupe
    const unsubscribeOffer = socket.on('group_call_offer', async (data: any) => {
      console.log('📨 Offre WebRTC reçue de', data.fromUserId);
      if (callManagerRef.current) {
        await callManagerRef.current.handleRemoteOffer(
          data.fromUserId,
          'Participant',
          data.offer
        );
      }
    });

    const unsubscribeAnswer = socket.on('group_call_answer', async (data: any) => {
      console.log('📩 Réponse WebRTC reçue de', data.fromUserId);
      if (callManagerRef.current) {
        await callManagerRef.current.handleRemoteAnswer(data.fromUserId, data.answer);
      }
    });

    const unsubscribeIce = socket.on('group_call_ice_candidate', async (data: any) => {
      console.log('🧊 ICE candidate reçu de', data.fromUserId);
      if (callManagerRef.current) {
        await callManagerRef.current.handleRemoteIceCandidate(
          data.fromUserId,
          data.candidate
        );
      }
    });

    const unsubscribeParticipantJoined = socket.on(
      'group_call_participant_joined',
      async (data: any) => {
        console.log('👤 Participant rejoint:', data.userId);
        if (callManagerRef.current) {
          try {
            await callManagerRef.current.createPeerConnection(
              data.userId,
              data.userName || 'Participant',
              true // Nous avons rejoint après l'initiateur, donc nous initions
            );
            setPeers(callManagerRef.current.getPeers());
          } catch (error) {
            console.error('Erreur création connexion peer:', error);
          }
        }
      }
    );

    const unsubscribeParticipantLeft = socket.on(
      'group_call_participant_rejected',
      (data: any) => {
        console.log('❌ Participant rejeté:', data.userId);
        if (callManagerRef.current) {
          callManagerRef.current.removePeer(data.userId);
          setPeers(callManagerRef.current.getPeers());
        }
      }
    );

    return () => {
      console.log('🚪 Quitter le groupe');
      unsubscribeMessage();
      unsubscribeInitiated();
      unsubscribeActive();
      unsubscribeEnded();
      unsubscribeOffer();
      unsubscribeAnswer();
      unsubscribeIce();
      unsubscribeParticipantJoined();
      unsubscribeParticipantLeft();
      unsubscribeParticipantCount();
      unsubscribePermission();
      socket.emit('leave_group', { groupId: teamId });
    };
  }, [socket, teamId, authStore.user?.id]);

  // Scroll vers le bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      await chatAPI.sendGroupMessage(teamId, newMessage, 'TEXT');
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Group Call UI */}
      <GroupCallUI
        callState={callState}
        peers={peers}
        localStream={callState?.localStream}
        onEndCall={handleEndCall}
        totalParticipants={totalParticipants}
        currentUserName={authStore.user?.name || 'You'}
      />

      {/* Permission Error Modal */}
      {permissionError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center max-w-sm">
            <h2 className="text-2xl font-bold mb-4 text-red-600">🔐 Permission requise</h2>
            <p className="text-gray-600 mb-6">
              {permissionError.message}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-yellow-800">
                <strong>Comment autoriser:</strong>
              </p>
              <ol className="text-sm text-yellow-800 list-decimal list-inside mt-2 space-y-1">
                <li>Cliquez sur l'icône 🔒 Cadenas dans la barre d'adresse</li>
                <li>Allez à "Permissions du site"</li>
                <li>Trouvez "Microphone" et "Caméra"</li>
                <li>Changez en "Permettre"</li>
                <li>Redémarrez le navigateur</li>
              </ol>
            </div>
            <button
              onClick={() => setPermissionError(null)}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Incoming Call Notification */}
      {incomingCall && !callState && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">📞 Appel entrant</h2>
            <p className="text-gray-600 mb-2">
              <strong>Type:</strong> {incomingCall.type === 'video' ? '📹 Vidéo' : '🎙️ Audio'}
            </p>
            <p className="text-gray-600 mb-6">
              Appel du groupe
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleAcceptCall}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                ✅ Accepter
              </button>
              <button
                onClick={handleRejectCall}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                ❌ Rejeter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">{teamName || 'Group Chat'}</h2>
        <div className="flex gap-2">
          {!activeCall && (
            <>
              <button
                onClick={() => handleStartCall('audio')}
                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 hover:text-blue-600"
                title="Appel audio"
              >
                <Phone size={20} />
              </button>
              <button
                onClick={() => handleStartCall('video')}
                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 hover:text-green-600"
                title="Appel vidéo"
              >
                <Video size={20} />
              </button>
            </>
          )}
          {activeCall && (
            <button
              onClick={handleEndCall}
              className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition text-white"
              title="Terminer l'appel"
            >
              <Phone size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Incoming Call Notification */}
      {incomingCall && (
        <div className="bg-blue-50 border-b border-blue-200 p-4 flex justify-between items-center">
          <p className="text-sm font-semibold text-blue-900">
            Appel {incomingCall.type === 'video' ? 'vidéo' : 'audio'} entrant...
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptCall}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition text-sm"
            >
              Accepter
            </button>
            <button
              onClick={handleRejectCall}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition text-sm"
            >
              Rejeter
            </button>
          </div>
        </div>
      )}

      {/* Active Call Info */}
      {activeCall && (
        <div className="bg-green-50 border-b border-green-200 p-4">
          <p className="text-sm font-semibold text-green-900">
            Appel {activeCall.type === 'video' ? 'vidéo' : 'audio'} en cours...
          </p>
          <p className="text-xs text-green-700 mt-1">
            Participants: {activeCall.participants.length}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Chargement des messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Aucun message pour le moment</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.userId === authStore.user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.userId === authStore.user?.id
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-900 rounded-bl-none'
                }`}
              >
                {msg.user && msg.userId !== authStore.user?.id && (
                  <p className="text-xs font-semibold mb-1 opacity-70">{msg.user.name}</p>
                )}
                <p className="overflow-wrap text-sm">{msg.message}</p>
                <p className="text-xs opacity-60 mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Tapez un message..."
            disabled={sending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
