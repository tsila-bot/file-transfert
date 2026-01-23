'use client';

import { Clock, Signal, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CallInfoProps {
  recipientName: string;
  recipientStatus?: 'connecting' | 'connected' | 'disconnected';
  duration?: number;
  connectionQuality?: 'good' | 'medium' | 'poor';
}

export function CallInfo({
  recipientName,
  recipientStatus = 'connecting',
  duration = 0,
  connectionQuality = 'good',
}: CallInfoProps) {
  const [displayDuration, setDisplayDuration] = useState('00:00');

  useEffect(() => {
    // Update display duration whenever duration prop changes
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    setDisplayDuration(
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }, [duration]);

  const statusColors = {
    connecting: 'bg-yellow-100 text-yellow-800',
    connected: 'bg-green-100 text-green-800',
    disconnected: 'bg-red-100 text-red-800',
  };

  const statusText = {
    connecting: 'Connexion en cours...',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{recipientName}</h2>
          <p className={`text-sm px-3 py-1 rounded-full inline-block mt-2 ${statusColors[recipientStatus]}`}>
            {statusText[recipientStatus]}
          </p>
        </div>
        {recipientStatus === 'connected' && (
          <div className="flex items-center gap-2 text-indigo-600 font-semibold">
            <Clock size={20} />
            <span>{displayDuration}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-gray-600">
          <Signal size={18} />
          <div>
            <p className="text-xs text-gray-500">Qualité</p>
            <p className="capitalize font-semibold">
              {connectionQuality === 'good' && '🟢 Bonne'}
              {connectionQuality === 'medium' && '🟡 Moyenne'}
              {connectionQuality === 'poor' && '🔴 Faible'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Users size={18} />
          <div>
            <p className="text-xs text-gray-500">Type</p>
            <p className="font-semibold">P2P Direct</p>
          </div>
        </div>
      </div>
    </div>
  );
}
