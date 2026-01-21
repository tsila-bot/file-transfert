'use client';

import { FaFileAlt, FaCalendar, FaUser, FaTrash, FaDownload } from 'react-icons/fa';

export default function SharedFilesPage() {
  const sharedFiles = [
    {
      id: 1,
      name: 'rapport_projet.pdf',
      size: '4.2 MB',
      date: '2024-01-20',
      sharedWith: 'John Doe',
    },
    { id: 2, name: 'budget.xlsx', size: '2.1 MB', date: '2024-01-19', sharedWith: 'Jane Smith' },
    { id: 3, name: 'slides.pptx', size: '9.5 MB', date: '2024-01-18', sharedWith: 'Team Lead' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Fichiers partagés</h1>
        <p className="text-gray-600 mt-2">
          Fichiers que vous avez partagés avec d'autres utilisateurs
        </p>
      </div>

      {/* Tableau des fichiers partagés */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fichier</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Taille</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Partagé avec
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sharedFiles.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-purple-500" />
                    <span className="font-medium text-gray-800">{file.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{file.size}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <FaUser size={14} className="text-blue-500" />
                    {file.sharedWith}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                  <FaCalendar size={14} /> {file.date}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                      <FaDownload />
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
