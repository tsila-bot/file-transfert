'use client';

import { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
}

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
}

export function MessageList({ messages, currentUserId, isLoading = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Chargement des messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Aucun message. Commencez la conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, idx) => {
        // Sécuriser le timestamp
        let msgDate: Date | null = null;
        try {
          if (msg.timestamp) {
            if (typeof msg.timestamp === 'string') {
              msgDate = new Date(msg.timestamp);
            } else if (msg.timestamp instanceof Date) {
              msgDate = msg.timestamp;
            }
            // Vérifier que la date est valide
            if (msgDate && isNaN(msgDate.getTime())) {
              msgDate = null;
            }
          }
        } catch (e) {
          msgDate = null;
        }

        const isCurrentUser = msg.senderId === currentUserId;
        let prevDate: Date | null = null;
        
        if (idx > 0 && messages[idx - 1].timestamp) {
          try {
            const prevTimestamp = messages[idx - 1].timestamp;
            if (typeof prevTimestamp === 'string') {
              prevDate = new Date(prevTimestamp);
            } else if (prevTimestamp instanceof Date) {
              prevDate = prevTimestamp;
            }
            if (prevDate && isNaN(prevDate.getTime())) {
              prevDate = null;
            }
          } catch (e) {
            prevDate = null;
          }
        }
        
        const showTimestamp =
          idx === 0 ||
          (msgDate && prevDate && Math.abs(msgDate.getTime() - prevDate.getTime()) > 5 * 60 * 1000);

        return (
          <div key={msg.id}>
            {showTimestamp && msgDate && (
              <div className="text-center text-xs text-gray-500 my-4">
                {format(msgDate, 'PPpp', { locale: fr })}
              </div>
            )}

            <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  isCurrentUser
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-900 rounded-bl-none'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${isCurrentUser ? 'text-indigo-100' : 'text-gray-500'}`}>
                  {msgDate ? format(msgDate, 'HH:mm') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
