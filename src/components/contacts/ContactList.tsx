'use client';

import { useState, useMemo } from 'react';
import ContactCard from './ContactCard';
import { Search, X } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'available' | 'busy' | 'offline' | 'in_call';
  lastSeen?: Date;
}

interface ContactListProps {
  contacts: Contact[];
  onSelectContact?: (contact: Contact) => void;
  onCall?: (contactId: string) => void;
  onMessage?: (contactId: string) => void;
}

export default function ContactList({
  contacts,
  onSelectContact,
  onCall,
  onMessage,
}: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query)
      );
    }

    // Filtre par statut
    if (statusFilter) {
      filtered = filtered.filter((contact) => contact.status === statusFilter);
    }

    return filtered;
  }, [contacts, searchQuery, statusFilter]);

  const statusCounts = {
    available: contacts.filter(c => c.status === 'available').length,
    busy: contacts.filter(c => c.status === 'busy').length,
    in_call: contacts.filter(c => c.status === 'in_call').length,
    offline: contacts.filter(c => c.status === 'offline').length,
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              statusFilter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tous ({contacts.length})
          </button>
          <button
            onClick={() => setStatusFilter('available')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              statusFilter === 'available'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En ligne ({statusCounts.available})
          </button>
          <button
            onClick={() => setStatusFilter('busy')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              statusFilter === 'busy'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Occupé ({statusCounts.busy})
          </button>
          <button
            onClick={() => setStatusFilter('in_call')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              statusFilter === 'in_call'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            En appel ({statusCounts.in_call})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              statusFilter === 'offline'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hors ligne ({statusCounts.offline})
          </button>
        </div>
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun contact trouvé</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery ? 'Essayez une autre recherche' : 'Ajoutez des contacts pour commencer'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onSelect={onSelectContact}
              onCall={onCall}
              onMessage={onMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
