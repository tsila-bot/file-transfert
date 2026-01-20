'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/shared/hooks/useSocket';
import { useAuthStore } from '@/stores/authStore';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConversationList } from './ConversationList';
import { Phone, Video, Info, Plus, X } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

interface OnlineUser {
  id: string;
  name: string;
  status: string;
}

export default function ChatWindow() {
  const socket = useSocket();
  const authStore = useAuthStore();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Charger conversations initiales
  useEffect(() => {
    if (socket.isConnected()) {
      console.log('📋 Loading conversations...');
      socket.emit('chat:load_conversations', {});
    }
  }, [socket]);

  // Écouter les conversations chargées
  useEffect(() => {
    const cleanup = socket.on('chat:conversations_loaded', (data: any) => {
      console.log('📥 Conversations received:', data);
      if (Array.isArray(data)) {
        setConversations(data);
      } else if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
      setIsLoading(false);
    });

    return cleanup;
  }, [socket]);

  // Écouter la liste des utilisateurs en ligne
  useEffect(() => {
    const cleanup = socket.on('chat:online_users_list', (data: any) => {
      console.log('👥 Online users received:', data);
      if (Array.isArray(data)) {
        setOnlineUsers(data.filter((u: OnlineUser) => u.id !== authStore.user?.id));
      } else if (data.users && Array.isArray(data.users)) {
        setOnlineUsers(data.users.filter((u: OnlineUser) => u.id !== authStore.user?.id));
      }
      setLoadingUsers(false);
    });

    return cleanup;
  }, [socket, authStore.user?.id]);

  // Écouter la création d'une nouvelle conversation
  useEffect(() => {
    const cleanup = socket.on('chat:conversation_started', (data: any) => {
      console.log('✨ New conversation created:', data);
      const newConversation: Conversation = {
        id: data.userId || data.id,
        userId: data.userId || data.id,
        userName: data.userName || data.name,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
      };
      setConversations((prev) => {
        // Vérifier si la conversation existe déjà
        const exists = prev.some((c) => c.id === newConversation.id);
        if (exists) return prev;
        return [newConversation, ...prev];
      });
      setSelectedConversation(newConversation.id);
      setShowNewConversation(false);
    });

    return cleanup;
  }, [socket]);

  // Charger messages de la conversation sélectionnée
  useEffect(() => {
    if (selectedConversation && socket.isConnected()) {
      socket.emit('chat:load_messages', { conversationId: selectedConversation });
    }
  }, [selectedConversation, socket]);

  // Écouter les nouveaux messages
  useEffect(() => {
    const cleanup = socket.on('chat_message', (data: any) => {
      if (data.conversationId === selectedConversation) {
        setMessages((prev) => [...prev, {
          id: data.id || `msg-${Date.now()}`,
          senderId: data.senderId,
          senderName: data.senderName,
          content: data.content,
          timestamp: new Date(data.timestamp),
          isRead: data.senderId === authStore.user?.id,
        }]);
      } else {
        // Mettre à jour le compteur non lu
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === data.conversationId
              ? { ...conv, unreadCount: conv.unreadCount + 1 }
              : conv
          )
        );
      }
    });

    return cleanup;
  }, [selectedConversation, socket, authStore.user?.id]);

  // Envoyer un message
  const handleSendMessage = (content: string, _attachments?: File[]) => {
    if (!selectedConversation || !content.trim()) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      senderId: authStore.user?.id || '',
      senderName: authStore.user?.name || 'You',
      content,
      timestamp: new Date(),
      isRead: true,
    };

    setMessages((prev) => [...prev, message]);

    // Envoyer via Socket.IO
    socket.emit('chat:send_message', {
      conversationId: selectedConversation,
      content,
      senderName: authStore.user?.name,
    });
  };

  // Sélectionner une conversation
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setMessages([]);
    setSearchQuery('');
  };

  // Démarrer une nouvelle conversation
  const handleStartConversation = (userId: string) => {
    console.log('💬 Starting conversation with:', userId);
    socket.emit('chat:start_conversation', { targetUserId: userId });
  };

  // Charger la liste des utilisateurs en ligne
  const handleLoadOnlineUsers = () => {
    console.log('👥 Loading online users...');
    setLoadingUsers(true);
    socket.emit('chat:get_online_users', {});
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement des conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-6">
      {/* Conversation List */}
      <div className="w-80 bg-white rounded-lg shadow flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Messages</h2>
            <button
              onClick={() => {
                setShowNewConversation(true);
                handleLoadOnlineUsers();
              }}
              className="p-2 hover:bg-indigo-100 rounded-lg transition text-indigo-600"
              title="Nouvelle conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <ConversationList
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">
                {conversations.find(c => c.id === selectedConversation)?.userName}
              </h3>
              <p className="text-sm text-gray-500">En ligne</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Video className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <Info className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <MessageList messages={messages} currentUserId={authStore.user?.id || ''} />

          {/* Input */}
          <MessageInput onSendMessage={handleSendMessage} />
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-lg shadow flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg">Sélectionnez une conversation</p>
            <p className="text-gray-400 text-sm mt-2">Ou commencez une nouvelle discussion</p>
          </div>
        </div>
      )}

      {/* Modal: Nouvelle conversation */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Nouvelle conversation</h3>
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : onlineUsers.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {onlineUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleStartConversation(user.id)}
                      className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-200"
                    >
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        En ligne
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Aucun utilisateur en ligne</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
