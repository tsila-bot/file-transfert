'use client';

import { Phone, PhoneOff } from 'lucide-react';

interface IncomingCallProps {
  callerName: string;
  callerAvatar?: string;
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function IncomingCall({
  callerName,
  callerAvatar,
  onAccept,
  onReject,
  isLoading = false,
}: IncomingCallProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 text-center max-w-sm">
        <div className="mb-6">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt={callerName}
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-5xl text-white">👤</span>
            </div>
          )}
          <h2 className="text-3xl font-bold text-gray-900">{callerName}</h2>
          <p className="text-gray-500 mt-2">Vous appelle...</p>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={onAccept}
            disabled={isLoading}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-8 py-4 rounded-full font-semibold transition transform hover:scale-105 disabled:cursor-not-allowed"
          >
            <Phone size={24} />
            Accepter
          </button>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-8 py-4 rounded-full font-semibold transition transform hover:scale-105 disabled:cursor-not-allowed"
          >
            <PhoneOff size={24} />
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
