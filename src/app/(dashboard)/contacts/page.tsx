'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePeerStore } from '@/stores/peerStore';
import ContactList from '@/components/contacts/ContactList';
import ContactSearch from '@/components/contacts/ContactSearch';
import { useRouter } from 'next/navigation';
import { useCall } from '@/shared/hooks/useCall';

export default function ContactsPage() {
  const peerStore = usePeerStore();
  const router = useRouter();
  const { startCall } = useCall();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCallingContactId, setIsCallingContactId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
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

  // Marquer comme côté client pour éviter les problèmes SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCall = useCallback(
    async (contactId: string) => {
      try {
        setIsCallingContactId(contactId);
        
        const contact = contacts.find((c) => c.id === contactId);
        if (!contact) {
          console.error('Contact non trouvé');
          setIsCallingContactId(null);
          return;
        }

        console.log('🎯 Appel à:', contact.name);

        // Démarrer l'appel
        await startCall(contactId, contact.name);

        // Rediriger vers la page d'appel seulement si succès
        setTimeout(() => {
          router.push('/calls');
          setIsCallingContactId(null);
        }, 500);
      } catch (error) {
        console.error('Erreur lors du démarrage de l\'appel:', error);
        // Ne pas afficher d'alerte - useCall gère déjà les erreurs
        setIsCallingContactId(null);
      }
    },
    [contacts, startCall, router]
  );

  const handleMessage = useCallback(
    (contactId: string) => {
      // Rediriger vers le chat avec ce contact
      router.push(`/chat?contactId=${contactId}`);
    },
    [router]
  );

  if (!isClient) {
    return null; // Évite les problèmes SSR
  }

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
