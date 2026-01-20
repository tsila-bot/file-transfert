'use client';

import { useState, useMemo } from 'react';
import { usePeerStore } from '@/stores/peerStore';
import ContactList from '@/components/contacts/ContactList';
import ContactSearch from '@/components/contacts/ContactSearch';
import { Phone, MessageCircle } from 'lucide-react';

export default function ContactsPage() {
  const peerStore = usePeerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const peers = peerStore.getOnlinePeers();

  // Transformer les peers au format Contact
  const contacts = useMemo(() => {
    return peers.map((peer) => ({
      id: peer.userId,
      name: peer.userName,
      email: `${peer.userId}@local`,
      avatar: peer.avatar,
      status: (peer.status || 'available') as 'available' | 'busy' | 'offline' | 'in_call',
      lastSeen: peer.connectedAt || new Date(),
    }));
  }, [peers]);

  // Filtrer les contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((contact) => contact.status === statusFilter);
    }

    return filtered;
  }, [contacts, searchQuery, statusFilter]);

  const handleCall = (contactId: string) => {
    console.log('Appel à:', contactId);
    // TODO: Implémenter l'appel WebRTC
  };

  const handleMessage = (contactId: string) => {
    console.log('Message à:', contactId);
    // TODO: Naviguer vers le chat avec ce contact
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <p className="text-gray-500 mt-1">
          {contacts.length} utilisateur{contacts.length > 1 ? 's' : ''} disponible{contacts.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="max-w-xl">
        <ContactSearch
          onSearch={setSearchQuery}
          onStatusFilter={setStatusFilter}
          placeholder="Rechercher un contact..."
          showFilters={true}
        />
      </div>

      {/* Contacts List */}
      <ContactList
        contacts={filteredContacts}
        onSelectContact={(contact) => {
          console.log('Contact sélectionné:', contact);
        }}
        onCall={handleCall}
        onMessage={handleMessage}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {contacts.filter(c => c.status === 'available').length}
          </div>
          <div className="text-sm text-green-700">En ligne</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">
            {contacts.filter(c => c.status === 'busy').length}
          </div>
          <div className="text-sm text-yellow-700">Occupé</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">
            {contacts.filter(c => c.status === 'in_call').length}
          </div>
          <div className="text-sm text-blue-700">En appel</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">
            {contacts.filter(c => c.status === 'offline').length}
          </div>
          <div className="text-sm text-gray-700">Hors ligne</div>
        </div>
      </div>
    </div>
  );
}
