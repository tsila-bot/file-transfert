'use client';

import { Phone, MessageCircle, MoreVertical } from 'lucide-react';
import { useState } from 'react';

interface ContactCardProps {
  contact: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status: 'available' | 'busy' | 'offline' | 'in_call';
    lastSeen?: Date;
  };
  onSelect?: (contact: any) => void;
  onCall?: (contactId: string) => void;
  onMessage?: (contactId: string) => void;
}

export default function ContactCard({
  contact,
  onSelect,
  onCall,
  onMessage,
}: ContactCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig = {
    available: { color: 'bg-green-600', label: 'En ligne' },
    busy: { color: 'bg-yellow-600', label: 'Occupé' },
    in_call: { color: 'bg-blue-600', label: 'En appel' },
    offline: { color: 'bg-gray-600', label: 'Hors ligne' },
  };

  const status = statusConfig[contact.status];

  // Générer initiales pour avatar
  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Couleur de gradient pour avatar
  const colors = ['from-blue-500', 'from-purple-500', 'from-pink-500', 'from-indigo-500'];
  const colorIndex = contact.id.charCodeAt(0) % colors.length;

  return (
    <div
      onClick={() => onSelect?.(contact)}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        {/* Left - Avatar & Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors[colorIndex]} to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
              {/* Status Indicator */}
              <div className={`w-3 h-3 rounded-full ${status.color} flex-shrink-0`} title={status.label} />
            </div>
            <p className="text-sm text-gray-500 truncate">{contact.email}</p>
            {contact.status === 'offline' && contact.lastSeen && (
              <p className="text-xs text-gray-400 mt-1">
                Vu à {new Date(contact.lastSeen).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMessage?.(contact.id);
            }}
            className="p-2 hover:bg-blue-50 rounded-lg transition text-blue-600"
            title="Envoyer un message"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCall?.(contact.id);
            }}
            disabled={contact.status === 'offline'}
            className="p-2 hover:bg-green-50 rounded-lg transition text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title={contact.status === 'offline' ? 'Non disponible' : 'Appeler'}
          >
            <Phone className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                  Voir le profil
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700">
                  Bloquer
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-red-600">
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
