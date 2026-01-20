'use client';

import { FaFileAlt, FaCalendar, FaSearch, FaTrash, FaDownload, FaShare } from 'react-icons/fa';
import { useState } from 'react';

export default function FilesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const files = [
    { id: 1, name: 'document.pdf', size: '2.5 MB', date: '2024-01-20', type: 'PDF' },
    { id: 2, name: 'rapport.docx', size: '1.2 MB', date: '2024-01-19', type: 'DOCX' },
    { id: 3, name: 'donnees.xlsx', size: '3.8 MB', date: '2024-01-18', type: 'XLSX' },
    { id: 4, name: 'presentation.pptx', size: '8.5 MB', date: '2024-01-17', type: 'PPTX' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Fichiers récents</h1>
        <p className="text-gray-600 mt-2">Consultez vos fichiers récemment utilisés</p>
      </div>

      {/* Recherche */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-4 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un fichier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Liste des fichiers */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fichier</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Taille</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-blue-500" />
                    <span className="font-medium text-gray-800">{file.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700">{file.type}</td>
                <td className="px-6 py-4 text-gray-600">{file.size}</td>
                <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                  <FaCalendar size={14} /> {file.date}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                      <FaDownload />
                    </button>
                    <button className="p-2 text-green-600 hover:bg-green-50 rounded">
                      <FaShare />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
