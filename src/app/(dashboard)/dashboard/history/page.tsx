'use client';

import { FaArrowRight, FaArrowLeft, FaClock, FaFileAlt } from 'react-icons/fa';

export default function HistoryPage() {
  const transfers = [
    {
      id: 1,
      name: 'document.pdf',
      type: 'sent',
      recipient: 'John Doe',
      date: '2024-01-20 14:30',
      size: '2.5 MB',
    },
    {
      id: 2,
      name: 'photo.jpg',
      type: 'received',
      sender: 'Jane Smith',
      date: '2024-01-20 12:15',
      size: '4.2 MB',
    },
    {
      id: 3,
      name: 'presentation.pptx',
      type: 'sent',
      recipient: 'Team Lead',
      date: '2024-01-19 09:45',
      size: '8.7 MB',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Historique des transferts</h1>
        <p className="text-gray-600 mt-2">Consultez l'historique de tous vos transferts</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-4">
        <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
          Tous
        </button>
        <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50">
          Envoyés
        </button>
        <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50">
          Reçus
        </button>
      </div>

      {/* Liste des transferts */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fichier</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Taille</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-blue-500" />
                    <span className="font-medium text-gray-800">{transfer.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {transfer.type === 'sent' ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <FaArrowRight /> Envoyé
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-600">
                      <FaArrowLeft /> Reçu
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-700">
                  {transfer.type === 'sent' ? transfer.recipient : transfer.sender}
                </td>
                <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                  <FaClock size={14} /> {transfer.date}
                </td>
                <td className="px-6 py-4 text-gray-700">{transfer.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
