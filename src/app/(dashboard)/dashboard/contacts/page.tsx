'use client';

import { FaUser, FaPhone, FaEnvelope, FaUserPlus, FaTrash } from 'react-icons/fa';

export default function ContactsPage() {
  const contacts = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+33 6 12 34 56 78',
      lastTransfer: '2024-01-20',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+33 6 98 76 54 32',
      lastTransfer: '2024-01-19',
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      phone: '+33 6 11 22 33 44',
      lastTransfer: '2024-01-18',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Mes Contacts</h1>
          <p className="text-gray-600 mt-2">Gérez vos contacts pour un transfert rapide</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
          <FaUserPlus /> Ajouter un contact
        </button>
      </div>

      {/* Grille de contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <FaUser size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{contact.name}</h3>
                <p className="text-sm text-gray-600">Dernier : {contact.lastTransfer}</p>
              </div>
            </div>

            <div className="space-y-3 mb-4 border-t pt-4">
              <div className="flex items-center gap-3 text-gray-700">
                <FaEnvelope size={16} className="text-blue-500" />
                <span className="text-sm">{contact.email}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <FaPhone size={16} className="text-green-500" />
                <span className="text-sm">{contact.phone}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm">
                Transférer
              </button>
              <button className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200">
                <FaTrash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
